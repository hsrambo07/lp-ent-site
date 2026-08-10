import{n as e,r as t,s as n,t as r}from"./jsx-runtime-M02E_j8Z.js";var i=e(),a=n(t(),1),o=r(),s=`#version 300 es
precision highp float;
in vec2 aCorner;   // -1..1 quad
in vec4 aSeed;     // xyz: unit direction (shared per strand), w: life phase
in vec4 aVar;      // x: life rate, y: brightness, z: <0 = infalling, w: width mul
in vec4 aSib;      // xyz: fragment scatter direction, w: sibling jitter
uniform float uTime, uR, uLen, uWidth, uAspect, uMinWidth, uShell, uWander;
out vec2 vUV;
out float vBright;

/* Life timeline: strand until TSPLIT, then a bright splash as it breaks,
   then the fragments. Siblings of one strand overlap exactly before the
   split (they stack additively into one hot dash) and scatter after it. */
const float TSPLIT = 0.22;
const float SPLASH_W = 0.045;

mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1.,0.,0., 0.,c,-s, 0.,s,c); }

/* Divergence-free turbulence (Bridson 2007): finite-difference curl of a
   smooth vector potential. Neighbouring particles sample nearly the same
   field, so the swirl is coherent — one fluid body, not per-grain jitter.
   The potential is a warped sum of sines: cheap, smooth, hash-free. */
vec3 potential(vec3 p) {
  p += 0.55 * vec3(sin(p.z * 0.9), sin(p.x * 1.1), sin(p.y * 0.8));
  return vec3(
    sin(p.y * 2.1) + cos(p.z * 1.7),
    sin(p.z * 2.3) + cos(p.x * 1.3),
    sin(p.x * 1.9) + cos(p.y * 2.7)
  );
}
vec3 curl(vec3 p) {
  const float e = 0.14;
  vec3 dx = potential(p + vec3(e, 0., 0.)) - potential(p - vec3(e, 0., 0.));
  vec3 dy = potential(p + vec3(0., e, 0.)) - potential(p - vec3(0., e, 0.));
  vec3 dz = potential(p + vec3(0., 0., e)) - potential(p - vec3(0., 0., e));
  return vec3(dy.z - dz.y, dz.x - dx.z, dx.y - dy.x) / (2.0 * e);
}

/* Position at life t, in three acts.
   Act 1 (t < TSPLIT): the strand — born just off the core, riding out fast
   toward the shell (this fast birth interval is what the motion blur combs
   radially). All siblings coincide: one bright dash.
   Act 2 (the split): the strand breaks at the shell in a splash.
   Act 3: fragments scatter along their own offsets; infalling ones drop
   back into the core, ejected ones drift out to the rim and stall.
   Everything rides the shared curl field (the Turbulence Field move). */
vec3 particlePos(float t, vec3 dir, vec3 sib, float infall, float seed) {
  // each strand breaks at its own radius — no hot ring at one shell
  float shellK = uShell * (0.88 + 0.24 * fract(seed * 13.7));
  float r;
  vec3 basedir = dir;
  if (t < TSPLIT) {
    float a = t / TSPLIT;
    r = mix(0.38, shellK, 1.0 - pow(1.0 - a, 2.4)); // a short bright run to the shell
  } else {
    float f = (t - TSPLIT) / (1.0 - TSPLIT);
    r = infall > 0.5
      ? mix(shellK, 0.05, smoothstep(0.0, 1.0, f))    // falls home
      : mix(shellK, 1.0, 1.0 - pow(1.0 - f, 3.2));    // thrown to the rim, stalls
    // fragments fan out from the break point along their own scatter dirs
    basedir = normalize(dir + sib * (0.18 * smoothstep(0.0, 0.5, f)));
  }
  vec3 base = basedir * r;
  // wavelength ≈ 0.4R, amplitude ≤ 0.3 × wavelength, evolution over seconds —
  // the coherence numbers that read as fluid.
  vec3 swirl = curl(base * 5.0 + vec3(0.0, uTime * 0.16, uTime * 0.11));
  float env = smoothstep(0.0, 0.15, t) * smoothstep(0.08, 0.35, r) * (1.0 - 0.85 * smoothstep(0.62, 1.0, r));
  return (base + swirl * uWander * env) * uR;
}

void main(){
  float t = fract(uTime * aVar.x + aSeed.w);
  vec3 dir = rotY(uTime * 0.13) * rotX(sin(uTime * 0.09) * 0.25) * aSeed.xyz;
  float infall = aVar.z < 0.0 ? 1.0 : 0.0;
  float lenMul = abs(aVar.z);

  // Sample the path twice: the streak IS the motion blur, so its axis and
  // length come from actual displacement. Foreshortening then falls out for
  // free — a grain flying at the camera barely moves in screen space.
  vec3 sib = aSib.xyz;
  float dt = 0.018;
  vec3 p0 = particlePos(t, dir, sib, infall, aSeed.w);
  vec3 p1 = particlePos(t + dt, dir, sib, infall, aSeed.w);

  vec3 pm = mix(p0, p1, 0.5);
  float persp = 2.6 / (2.6 - pm.z);
  vec2 s0 = p0.xy * (2.6 / (2.6 - p0.z));
  vec2 s1 = p1.xy * (2.6 / (2.6 - p1.z));
  vec2 seg = s1 - s0;
  float segLen = length(seg);
  vec2 sdir = segLen > 1e-6 ? seg / segLen : vec2(1.0, 0.0);
  // The reference's dashes stay radially combed even where flight stalls:
  // its motion blur includes the fast birth interval. Blend toward radial.
  vec2 rdir = normalize(pm.xy + vec2(1e-5));
  if (dot(rdir, sdir) < 0.0) rdir = -rdir;
  sdir = normalize(mix(sdir, rdir, 0.55));

  // The break: a gaussian flare in brightness and girth right at TSPLIT —
  // the splash — after which fragments run at ~45% size.
  float splash = exp(-pow((t - TSPLIT) / SPLASH_W, 2.0));
  float frag = smoothstep(TSPLIT, TSPLIT + 0.06, t);   // 0 strand → 1 fragment

  float wid0 = uWidth * aVar.w * persp * mix(1.0, 0.45, frag) * (1.0 + 0.7 * splash);
  // Strands are the long dashes (p90 aspect ~3); fragments squat down.
  float maxAspect = mix(3.4, 1.9, frag);
  float len = clamp(segLen * uLen * lenMul, wid0 * 1.1, wid0 * maxAspect);
  // Floor the width in device pixels. Sub-pixel grains alias into a
  // shimmering mess at small sizes and on low-DPR screens.
  float wid = max(wid0, uMinWidth);
  len = max(len, uMinWidth * 1.3);

  vec2 pos = pm.xy * persp
           + sdir * (aCorner.y * len)
           + vec2(-sdir.y, sdir.x) * (aCorner.x * wid);
  pos.x /= uAspect;
  gl_Position = vec4(pos, 0.0, 1.0);
  vUV = aCorner;

  float r = length(pm) / uR;
  float birth = smoothstep(0.0, 0.05, t);
  // Ejected fragments reach the rim early and sit there fading, which is
  // why the reference's outer halo measures as motionless.
  float death = 1.0 - smoothstep(infall > 0.5 ? 0.88 : 0.7, 1.0, t);
  float flick = 0.84 + 0.16 * sin(uTime * 6.2831 * (0.2 + 0.6 * fract(aSeed.w * 7.31)) + aSeed.w * 43.0);
  // Density goes as 1/r², so grains stack up and clip to white near the middle.
  float nearCore = 1.0 + 4.0 * exp(-r / 0.24);
  // Strand light ramps toward the break (the interior stays dark), fragments
  // run dimmer, and the splash spikes 1.6x at the break itself.
  float strandRamp = mix(0.4 + 0.6 * smoothstep(0.0, TSPLIT, t), 0.72, frag);
  float phase = strandRamp + 1.6 * splash;
  vBright = birth * death * aVar.y * flick * nearCore * phase * (0.55 + 0.30 * persp);
}`,c=`#version 300 es
precision highp float;
in vec2 vUV;
in float vBright;
uniform vec3 uTint;
out vec4 outColor;
void main(){
  // Elongated gaussian: the reference's grains are soft blobs (median aspect
  // 1.45, edge-hardness 0.43 measured), not hard capsules.
  float m = exp(-(vUV.x * vUV.x * 5.2 + vUV.y * vUV.y * 2.8));
  if (m < 0.012) discard;
  vec3 col = mix(uTint, vec3(1.0), min(1.0, vBright * 0.9));
  outColor = vec4(col * vBright * m, 1.0);
}`,l=`#version 300 es
precision highp float;
in vec2 aCorner;
uniform float uScale, uAspect;
out vec2 vUV;
void main(){
  vUV = aCorner;
  vec2 p = aCorner * uScale;
  p.x /= uAspect;
  gl_Position = vec4(p, 0.0, 1.0);
}`,u=`#version 300 es
precision highp float;
in vec2 vUV;
uniform float uIntensity, uPow;
uniform vec3 uColor;
out vec4 outColor;
void main(){
  float d = length(vUV);
  if (d > 1.0) discard;
  outColor = vec4(uColor * pow(max(0.0, 1.0 - d), uPow) * uIntensity, 1.0);
}`,d=`#version 300 es
precision highp float;
in vec2 aCorner;
out vec2 vUV;
void main(){ vUV = aCorner * 0.5 + 0.5; gl_Position = vec4(aCorner, 0.0, 1.0); }`,f=`#version 300 es
precision highp float;
uniform float uFade;
out vec4 outColor;
void main(){ outColor = vec4(0.0, 0.0, 0.0, uFade); }`,p=`#version 300 es
precision highp float;
in vec2 vUV; uniform sampler2D uTex; out vec4 outColor;
void main(){
  vec3 c = texture(uTex, vUV).rgb;
  outColor = vec4(c * smoothstep(0.3, 0.9, dot(c, vec3(0.299, 0.587, 0.114))), 1.0);
}`,m=`#version 300 es
precision highp float;
in vec2 vUV; uniform sampler2D uTex; uniform vec2 uDir; out vec4 outColor;
void main(){
  vec3 s = texture(uTex, vUV).rgb * 0.2270270270;
  s += (texture(uTex, vUV + uDir * 1.3846153846).rgb
     +  texture(uTex, vUV - uDir * 1.3846153846).rgb) * 0.3162162162;
  s += (texture(uTex, vUV + uDir * 3.2307692308).rgb
     +  texture(uTex, vUV - uDir * 3.2307692308).rgb) * 0.0702702703;
  outColor = vec4(s, 1.0);
}`,h=`#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uScene, uBloom;
uniform float uBloomMix, uExpo;
out vec4 outColor;

// Interleaved gradient noise (Jimenez). One LSB of dither — without it the
// halo bands visibly against near-black in 8-bit.
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

void main(){
  vec3 c = texture(uScene, vUV).rgb + texture(uBloom, vUV).rgb * uBloomMix;
  c = vec3(1.0) - exp(-c * uExpo);   // clips the core to flat white
  c += (1.0 / 255.0) * ign(gl_FragCoord.xy) - (0.5 / 255.0);
  outColor = vec4(c, max(c.r, max(c.g, c.b)));
}`,g=[[.72,.04,3,[.56,.68,1]],[.48,.13,2.4,[.62,.75,1]],[.32,.5,2.4,[.84,.9,1]],[.27,2,2,[.97,.98,1]],[.15,3.6,1.6,[1,1,1]]];function _(e,t,n){let r=e.createShader(t);if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS))throw Error(e.getShaderInfoLog(r)??`compile failed`);return r}function v(e,t,n){let r=e.createProgram();if(e.attachShader(r,_(e,e.VERTEX_SHADER,t)),e.attachShader(r,_(e,e.FRAGMENT_SHADER,n)),e.linkProgram(r),!e.getProgramParameter(r,e.LINK_STATUS))throw Error(e.getProgramInfoLog(r)??`link failed`);return r}function y({size:e=220,count:t=3400,tint:n=[.62,.76,1],infallFraction:r=.5,shell:i=.5,wander:_=.015,className:y}){let b=(0,a.useRef)(null);return(0,a.useEffect)(()=>{let a=b.current;if(!a)return;let o=a.getContext(`webgl2`,{alpha:!0,antialias:!1,premultipliedAlpha:!0});if(!o){a.style.background=`radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(190,215,255,0.35) 18%, rgba(120,150,220,0.10) 42%, transparent 70%)`;return}let y=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches,x=Math.min(window.devicePixelRatio||1,2),S=Math.round(e*x);a.width=S,a.height=S;let C=v(o,s,c),w=v(o,l,u),T=v(o,d,f),E=v(o,d,p),D=v(o,d,m),O=v(o,d,h),k=o.createBuffer();o.bindBuffer(o.ARRAY_BUFFER,k),o.bufferData(o.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),o.STATIC_DRAW);let A=Math.ceil(t/3),j=A*3,M=new Float32Array(j*4),N=new Float32Array(j*4),P=new Float32Array(j*4);for(let e=0;e<A;e++){let t=Math.random()*2-1,n=Math.random()*Math.PI*2,i=Math.sqrt(1-t*t),a=i*Math.cos(n),o=i*Math.sin(n),s=t,c=Math.random(),l=.066*(.75+Math.random()*.6),u=.5+Math.random()*1.2;for(let t=0;t<3;t++){let n=e*3+t;M[n*4]=a,M[n*4+1]=o,M[n*4+2]=s,M[n*4+3]=c;let i=Math.random();N[n*4]=l,N[n*4+1]=(.24+i*i*i*2.8)/2.55;let d=t===0||t!==1&&Math.random()<r*.8;N[n*4+2]=d?-u:u,N[n*4+3]=.7+Math.random()*.8;let f=Math.random()*2-1,p=Math.random()*2-1,m=Math.random()*2-1,h=f*a+p*o+m*s;f-=h*a,p-=h*o,m-=h*s;let g=Math.hypot(f,p,m)||1;P[n*4]=f/g,P[n*4+1]=p/g,P[n*4+2]=m/g,P[n*4+3]=Math.random()}}let F=o.createBuffer();o.bindBuffer(o.ARRAY_BUFFER,F),o.bufferData(o.ARRAY_BUFFER,M,o.STATIC_DRAW);let I=o.createBuffer();o.bindBuffer(o.ARRAY_BUFFER,I),o.bufferData(o.ARRAY_BUFFER,N,o.STATIC_DRAW);let L=o.createBuffer();o.bindBuffer(o.ARRAY_BUFFER,L),o.bufferData(o.ARRAY_BUFFER,P,o.STATIC_DRAW);let R=o.createVertexArray();o.bindVertexArray(R),o.bindBuffer(o.ARRAY_BUFFER,k);let z=o.getAttribLocation(C,`aCorner`);o.enableVertexAttribArray(z),o.vertexAttribPointer(z,2,o.FLOAT,!1,0,0),o.bindBuffer(o.ARRAY_BUFFER,F),z=o.getAttribLocation(C,`aSeed`),o.enableVertexAttribArray(z),o.vertexAttribPointer(z,4,o.FLOAT,!1,0,0),o.vertexAttribDivisor(z,1),o.bindBuffer(o.ARRAY_BUFFER,I),z=o.getAttribLocation(C,`aVar`),o.enableVertexAttribArray(z),o.vertexAttribPointer(z,4,o.FLOAT,!1,0,0),o.vertexAttribDivisor(z,1),o.bindBuffer(o.ARRAY_BUFFER,L),z=o.getAttribLocation(C,`aSib`),o.enableVertexAttribArray(z),o.vertexAttribPointer(z,4,o.FLOAT,!1,0,0),o.vertexAttribDivisor(z,1);let B=o.createVertexArray();o.bindVertexArray(B),o.bindBuffer(o.ARRAY_BUFFER,k),z=o.getAttribLocation(w,`aCorner`),o.enableVertexAttribArray(z),o.vertexAttribPointer(z,2,o.FLOAT,!1,0,0),o.bindVertexArray(null);let V=o.getExtension(`EXT_color_buffer_float`),ee=V?o.RGBA16F:o.RGBA8,te=V?o.HALF_FLOAT:o.UNSIGNED_BYTE,H=[],U=(e,t)=>{let n=o.createTexture();o.bindTexture(o.TEXTURE_2D,n),o.texImage2D(o.TEXTURE_2D,0,ee,e,t,0,o.RGBA,te,null),o.texParameteri(o.TEXTURE_2D,o.TEXTURE_MIN_FILTER,o.LINEAR),o.texParameteri(o.TEXTURE_2D,o.TEXTURE_MAG_FILTER,o.LINEAR),o.texParameteri(o.TEXTURE_2D,o.TEXTURE_WRAP_S,o.CLAMP_TO_EDGE),o.texParameteri(o.TEXTURE_2D,o.TEXTURE_WRAP_T,o.CLAMP_TO_EDGE);let r=o.createFramebuffer();o.bindFramebuffer(o.FRAMEBUFFER,r),o.framebufferTexture2D(o.FRAMEBUFFER,o.COLOR_ATTACHMENT0,o.TEXTURE_2D,n,0),o.bindFramebuffer(o.FRAMEBUFFER,null);let i={fb:r,tex:n};return H.push(i),i},W=U(S,S);o.bindFramebuffer(o.FRAMEBUFFER,W.fb),o.clearColor(0,0,0,0),o.clear(o.COLOR_BUFFER_BIT),o.bindFramebuffer(o.FRAMEBUFFER,null);let G=Math.max(1,S>>2),K=U(G,G),q=U(G,G),J={time:o.getUniformLocation(C,`uTime`),r:o.getUniformLocation(C,`uR`),len:o.getUniformLocation(C,`uLen`),width:o.getUniformLocation(C,`uWidth`),aspect:o.getUniformLocation(C,`uAspect`),minWidth:o.getUniformLocation(C,`uMinWidth`),shell:o.getUniformLocation(C,`uShell`),wander:o.getUniformLocation(C,`uWander`),tint:o.getUniformLocation(C,`uTint`)},Y={scale:o.getUniformLocation(w,`uScale`),aspect:o.getUniformLocation(w,`uAspect`),intensity:o.getUniformLocation(w,`uIntensity`),pow:o.getUniformLocation(w,`uPow`),color:o.getUniformLocation(w,`uColor`)},ne=o.getUniformLocation(T,`uFade`),X=o.getUniformLocation(D,`uDir`),Z={scene:o.getUniformLocation(O,`uScene`),bloom:o.getUniformLocation(O,`uBloom`),mix:o.getUniformLocation(O,`uBloomMix`),expo:o.getUniformLocation(O,`uExpo`)},Q=e=>{o.enable(o.BLEND),o.blendFunc(o.SRC_ALPHA,o.ONE),o.bindFramebuffer(o.FRAMEBUFFER,W.fb),o.viewport(0,0,S,S),o.blendFunc(o.SRC_ALPHA,o.ONE_MINUS_SRC_ALPHA),o.useProgram(T),o.bindVertexArray(B),o.uniform1f(ne,.62),o.drawArrays(o.TRIANGLES,0,6),o.blendFunc(o.SRC_ALPHA,o.ONE),o.useProgram(w),o.bindVertexArray(B),o.uniform1f(Y.aspect,1);for(let[e,t,n,r]of g)o.uniform1f(Y.scale,e),o.uniform1f(Y.intensity,t),o.uniform1f(Y.pow,n),o.uniform3fv(Y.color,r),o.drawArrays(o.TRIANGLES,0,6);o.useProgram(C),o.bindVertexArray(R),o.uniform1f(J.time,e),o.uniform1f(J.r,.62),o.uniform1f(J.len,3.4),o.uniform1f(J.width,.012),o.uniform1f(J.shell,i),o.uniform1f(J.wander,_),o.uniform1f(J.aspect,1),o.uniform1f(J.minWidth,1.15/S),o.uniform3fv(J.tint,n),o.drawArraysInstanced(o.TRIANGLES,0,6,j),o.disable(o.BLEND),o.bindVertexArray(B),o.bindFramebuffer(o.FRAMEBUFFER,K.fb),o.viewport(0,0,G,G),o.useProgram(E),o.activeTexture(o.TEXTURE0),o.bindTexture(o.TEXTURE_2D,W.tex),o.drawArrays(o.TRIANGLES,0,6),o.useProgram(D);for(let e=0;e<2;e++)o.bindFramebuffer(o.FRAMEBUFFER,q.fb),o.bindTexture(o.TEXTURE_2D,K.tex),o.uniform2f(X,1/G,0),o.drawArrays(o.TRIANGLES,0,6),o.bindFramebuffer(o.FRAMEBUFFER,K.fb),o.bindTexture(o.TEXTURE_2D,q.tex),o.uniform2f(X,0,1/G),o.drawArrays(o.TRIANGLES,0,6);o.bindFramebuffer(o.FRAMEBUFFER,null),o.viewport(0,0,S,S),o.useProgram(O),o.activeTexture(o.TEXTURE0),o.bindTexture(o.TEXTURE_2D,W.tex),o.uniform1i(Z.scene,0),o.activeTexture(o.TEXTURE1),o.bindTexture(o.TEXTURE_2D,K.tex),o.uniform1i(Z.bloom,1),o.uniform1f(Z.mix,1),o.uniform1f(Z.expo,.82),o.drawArrays(o.TRIANGLES,0,6)},$=0,re=!0,ie=new IntersectionObserver(([e])=>{re=e.isIntersecting});ie.observe(a);let ae=()=>re&&document.visibilityState===`visible`,oe=e=>{e.preventDefault(),cancelAnimationFrame($)};if(a.addEventListener(`webglcontextlost`,oe),y)for(let e=0;e<8;e++)Q(2.5+e*.016);else{let e=performance.now(),t=n=>{$=requestAnimationFrame(t),ae()&&Q((n-e)*.001)};$=requestAnimationFrame(t)}return()=>{cancelAnimationFrame($),ie.disconnect(),a.removeEventListener(`webglcontextlost`,oe);for(let e of H)o.deleteFramebuffer(e.fb),o.deleteTexture(e.tex);o.deleteBuffer(k),o.deleteBuffer(F),o.deleteBuffer(I),o.deleteBuffer(L),o.deleteVertexArray(R),o.deleteVertexArray(B);for(let e of[C,w,E,D,O])o.deleteProgram(e)}},[e,t,n,r,i,_]),(0,o.jsx)(`canvas`,{ref:b,"aria-hidden":!0,className:y,style:{width:e,height:e,display:`block`}})}function b(){let[e,t]=(0,a.useState)(1);return(0,a.useEffect)(()=>{let e=setInterval(()=>t(e=>e%3+1),450);return()=>clearInterval(e)},[]),(0,o.jsx)(`span`,{className:`inline-block w-6 text-left`,children:`.`.repeat(e)})}function x(){return(0,o.jsx)(`main`,{className:`zone-dark min-h-screen bg-[#0a0a0b] px-6 py-16 text-fog`,children:(0,o.jsxs)(`div`,{className:`mx-auto flex max-w-5xl flex-col gap-14`,children:[(0,o.jsxs)(`header`,{children:[(0,o.jsx)(`p`,{className:`font-mono text-xs uppercase tracking-widest text-faint`,children:`WebGL2 · instanced streak quads · additive · bloom`}),(0,o.jsx)(`h1`,{className:`mt-3 text-4xl [font-family:var(--font-display)]`,children:`Glowing particle burst`}),(0,o.jsx)(`p`,{className:`mt-3 max-w-[62ch] leading-relaxed text-mute`,children:`A continuous radial emitter: grains fly outward from a blown-out core, each stretched along the screen projection of its own direction, so the field reads as a 3D volume rather than a flat starburst. Rebuilt in raw WebGL2 from the effect Jakub Wuzik posted.`})]}),(0,o.jsx)(`section`,{className:`relative overflow-hidden rounded-3xl border border-white/10 bg-[#101012] p-4`,children:(0,o.jsxs)(`div`,{className:`flex min-h-[420px] items-center gap-2`,children:[(0,o.jsx)(y,{size:340}),(0,o.jsxs)(`p`,{className:`-ml-6 text-4xl font-light tracking-tight text-white/85`,children:[`Calculating`,(0,o.jsx)(b,{})]})]})}),(0,o.jsxs)(`section`,{children:[(0,o.jsx)(`p`,{className:`font-mono text-xs uppercase tracking-widest text-faint`,children:`Scales down`}),(0,o.jsx)(`div`,{className:`mt-6 flex flex-wrap items-center gap-10`,children:[240,140,84,48].map(e=>(0,o.jsxs)(`div`,{className:`flex flex-col items-center gap-3`,children:[(0,o.jsx)(y,{size:e,count:e>100?1800:900}),(0,o.jsxs)(`span`,{className:`font-mono text-xs text-faint`,children:[e,`px`]})]},e))})]}),(0,o.jsxs)(`section`,{children:[(0,o.jsx)(`p`,{className:`font-mono text-xs uppercase tracking-widest text-faint`,children:`Inline, as a chip`}),(0,o.jsxs)(`div`,{className:`mt-6 flex flex-wrap items-center gap-4`,children:[(0,o.jsxs)(`span`,{className:`flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] py-1.5 pl-1 pr-4`,children:[(0,o.jsx)(y,{size:34,count:700}),(0,o.jsxs)(`span`,{className:`font-mono text-sm text-white/70`,children:[`routing 10 requests`,(0,o.jsx)(b,{})]})]}),(0,o.jsxs)(`span`,{className:`flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] py-1.5 pl-1 pr-4`,children:[(0,o.jsx)(y,{size:34,count:700,tint:[.83,.96,.45]}),(0,o.jsxs)(`span`,{className:`font-mono text-sm text-white/70`,children:[`brand tint`,(0,o.jsx)(b,{})]})]})]})]})]})})}(0,i.createRoot)(document.getElementById(`root`)).render((0,o.jsx)(a.StrictMode,{children:(0,o.jsx)(x,{})}));