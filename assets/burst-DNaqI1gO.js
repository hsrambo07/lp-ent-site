import{n as e,r as t,s as n,t as r}from"./jsx-runtime-BKU2sOBx.js";var i=e(),a=n(t(),1),o=r(),s=`#version 300 es
precision highp float;
in vec2 aCorner;   // -1..1 quad
in vec4 aSeed;     // xyz: unit direction (shared per strand), w: life phase
in vec4 aVar;      // x: life rate, y: brightness, z: <0 = infalling, w: width mul
in vec4 aSib;      // xyz: fragment scatter direction, w: sibling jitter
uniform float uTime, uR, uLen, uWidth, uAspect, uMinWidth, uShell, uWander, uDrift;
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

/* Position at life t.

   Two things have to be true at once, and getting only one of them is what
   made earlier versions read either as a spiky star or a static pom:

   1. DENSITY. Each grain owns a home radius sampled uniform-in-volume (∝ r²)
      and a random phase, so the ensemble keeps the disc evenly filled from
      core to rim no matter where individual grains are in their life.
   2. TRAVEL. Each grain actually goes somewhere over that life. Grains
      inside the shell accelerate *into* the core — fast, shrinking and
      brightening as they compress (the nuclear middle). Grains outside it
      are thrown outward, decelerating and thinning into the rim.

   Because the starts are spread and the phases are random, the field stays
   uniformly populated while every individual grain is visibly in flight. */
vec3 particlePos(float t, vec3 dir, vec3 sib, float home, float seed) {
  float toCore = home < uShell ? 1.0 : 0.0;
  // Travel a bounded distance from home rather than all the way to an
  // endpoint. Running every grain to the core or the rim evacuated the middle
  // band — the very region the reference is brightest in.
  float r = toCore > 0.5
    // Gravity: r shrinks as a power of remaining life, so dr/dt grows without
    // bound as the grain nears the middle. The long trails combing into the
    // core are the motion blur of that acceleration.
    ? max(home * pow(1.0 - t, 0.62), 0.035)
    : mix(home, min(home + 0.34, 1.03), 1.0 - pow(1.0 - t, 2.2)); // thrown out

  // Grains swing round as they fall — angular speed rises as r drops, so the
  // inner field revolves faster than the outer one.
  float swing = toCore > 0.5 ? 0.1 * t / max(r, 0.18) : 0.08 * t;
  vec3 basedir = normalize(dir + sib * swing);

  vec3 base = basedir * r;
  // wavelength ≈ 0.4R, amplitude ≤ 0.3 × wavelength, evolution over seconds —
  // the coherence numbers that read as fluid.
  vec3 swirl = curl(base * 5.0 + vec3(0.0, uTime * 0.07, uTime * 0.05));
  float env = smoothstep(0.06, 0.3, r) * (1.0 - 0.7 * smoothstep(0.7, 1.0, r));
  return (base + swirl * uWander * env) * uR;
}

void main(){
  float t = fract(uTime * aVar.x + aSeed.w);
  vec3 dir = rotY(uTime * 0.05) * rotX(sin(uTime * 0.04) * 0.2) * aSeed.xyz;
  float lenMul = abs(aVar.z);
  float home = aSib.w;   // home radius, sampled uniform-in-volume on the CPU

  // Sample the path twice: the streak IS the motion blur, so its axis and
  // length come from actual displacement. Foreshortening then falls out for
  // free — a grain flying at the camera barely moves in screen space.
  vec3 sib = aSib.xyz;
  float dt = 0.018;
  vec3 p0 = particlePos(t, dir, sib, home, aSeed.w);
  vec3 p1 = particlePos(t + dt, dir, sib, home, aSeed.w);

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
  sdir = normalize(mix(sdir, rdir, 0.8));

  // A brief flare partway through life: the grain brightens and fattens,
  // then settles — the "splash" without the spike geometry that came with it.
  float splash = exp(-pow((t - TSPLIT) / SPLASH_W, 2.0));

  float rNow = length(pm) / uR;
  // Grains shrink as they compress into the core and thin out again at the
  // rim; they are fattest through the middle band where the dashes read.
  float sizeR = smoothstep(0.03, 0.3, rNow) * (1.0 - 0.4 * smoothstep(0.55, 1.0, rNow));
  float wid0 = uWidth * aVar.w * persp * sizeR * (1.0 + 0.35 * splash);
  // Grain geometry is fixed, not motion-derived. The reference's dashes run a
  // tight median aspect of 1.45 everywhere; deriving length from displacement
  // is what produced long spikes in the fast band and dots in the slow one.
  // Aspect is radius-dependent: long combed trails near the middle where the
  // grain is moving fastest, tight dashes out in the shell.
  float maxAspect = mix(3.6, 2.4, smoothstep(0.08, 0.45, rNow));
  float len = wid0 * lenMul + segLen * uLen * 0.3;
  len = clamp(len, wid0 * 1.3, wid0 * maxAspect);
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

  float r = rNow;
  // Long, symmetric fade in and out — no hard births, and the envelope stays
  // well under 1 Hz so nothing strobes.
  float envLife = smoothstep(0.0, 0.22, t) * (1.0 - smoothstep(0.78, 1.0, t));
  float flick = 0.86 + 0.14 * sin(uTime * 6.2831 * (0.2 + 0.6 * fract(aSeed.w * 7.31)) + aSeed.w * 43.0);
  // Measured off the reference: its bright zone is only 36% of the radius,
  // so light is concentrated hard in the middle and falls away fast. A flat
  // profile is exactly what made this read as an evenly-lit dandelion.
  float radial = 0.8 + 0.2 * exp(-r * 2.0);
  // The nuclear middle: grains compress and flare as they reach the core.
  float nuclear = 1.0 + 2.6 * exp(-r / 0.2);
  float rimFade = 1.0 - 0.94 * smoothstep(0.76, 1.08, r);
  vBright = envLife * aVar.y * flick * radial * nuclear * rimFade
          * (1.0 + 0.9 * splash) * (0.7 + 0.3 * persp);
}`,c=`#version 300 es
precision highp float;
in vec2 vUV;
in float vBright;
uniform vec3 uTint;
out vec4 outColor;
void main(){
  // Elongated gaussian: the reference's grains are soft blobs (median aspect
  // 1.45, edge-hardness 0.43 measured), not hard capsules.
  float m = exp(-(vUV.x * vUV.x * 4.6 + vUV.y * vUV.y * 2.6));
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
}`,ee=`#version 300 es
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
}`,te=[[1,.13,2.2,[.5,.62,.95]],[.8,.28,2.1,[.6,.72,1]],[.5,.38,2.4,[.72,.82,1]],[.3,.46,3,[.86,.92,1]],[.19,1.05,3.2,[.94,.96,1]],[.1,1.9,2.6,[.98,.99,1]]];function h(e,t,n){let r=e.createShader(t);if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS))throw Error(e.getShaderInfoLog(r)??`compile failed`);return r}function g(e,t,n){let r=e.createProgram();if(e.attachShader(r,h(e,e.VERTEX_SHADER,t)),e.attachShader(r,h(e,e.FRAGMENT_SHADER,n)),e.linkProgram(r),!e.getProgramParameter(r,e.LINK_STATUS))throw Error(e.getProgramInfoLog(r)??`link failed`);return r}function _({size:e=220,count:t=9e3,tint:n=[.62,.76,1],infallFraction:r=.5,shell:i=.5,wander:h=.015,drift:_=.18,className:v}){let y=(0,a.useRef)(null);return(0,a.useEffect)(()=>{let r=y.current;if(!r)return;let a=r.getContext(`webgl2`,{alpha:!0,antialias:!1,premultipliedAlpha:!0});if(!a){r.style.background=`radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(190,215,255,0.35) 18%, rgba(120,150,220,0.10) 42%, transparent 70%)`;return}let o=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches,v=Math.min(window.devicePixelRatio||1,2),b=Math.round(e*v);r.width=b,r.height=b;let x=g(a,s,c),S=g(a,l,u),C=g(a,d,f),w=g(a,d,p),T=g(a,d,m),E=g(a,d,ee),D=a.createBuffer();a.bindBuffer(a.ARRAY_BUFFER,D),a.bufferData(a.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),a.STATIC_DRAW);let O=t,k=new Float32Array(O*4),A=new Float32Array(O*4),j=new Float32Array(O*4);for(let e=0;e<O;e++){let t=Math.random()*2-1,n=Math.random()*Math.PI*2,r=Math.sqrt(1-t*t),i=r*Math.cos(n),a=r*Math.sin(n),o=t;k[e*4]=i,k[e*4+1]=a,k[e*4+2]=o,k[e*4+3]=Math.random();let s=Math.random();A[e*4]=.03*(.75+Math.random()*.6),A[e*4+1]=.1+s*s*s*2.6,A[e*4+2]=1.5+Math.random()*1.4,A[e*4+3]=.75+Math.random()*.6;let c=Math.random()*2-1,l=Math.random()*2-1,u=Math.random()*2-1,d=c*i+l*a+u*o;c-=d*i,l-=d*a,u-=d*o;let f=Math.hypot(c,l,u)||1;j[e*4]=c/f,j[e*4+1]=l/f,j[e*4+2]=u/f,j[e*4+3]=.07+.96*Math.random()**.5}let M=a.createBuffer();a.bindBuffer(a.ARRAY_BUFFER,M),a.bufferData(a.ARRAY_BUFFER,k,a.STATIC_DRAW);let N=a.createBuffer();a.bindBuffer(a.ARRAY_BUFFER,N),a.bufferData(a.ARRAY_BUFFER,A,a.STATIC_DRAW);let P=a.createBuffer();a.bindBuffer(a.ARRAY_BUFFER,P),a.bufferData(a.ARRAY_BUFFER,j,a.STATIC_DRAW);let F=a.createVertexArray();a.bindVertexArray(F),a.bindBuffer(a.ARRAY_BUFFER,D);let I=a.getAttribLocation(x,`aCorner`);a.enableVertexAttribArray(I),a.vertexAttribPointer(I,2,a.FLOAT,!1,0,0),a.bindBuffer(a.ARRAY_BUFFER,M),I=a.getAttribLocation(x,`aSeed`),a.enableVertexAttribArray(I),a.vertexAttribPointer(I,4,a.FLOAT,!1,0,0),a.vertexAttribDivisor(I,1),a.bindBuffer(a.ARRAY_BUFFER,N),I=a.getAttribLocation(x,`aVar`),a.enableVertexAttribArray(I),a.vertexAttribPointer(I,4,a.FLOAT,!1,0,0),a.vertexAttribDivisor(I,1),a.bindBuffer(a.ARRAY_BUFFER,P),I=a.getAttribLocation(x,`aSib`),a.enableVertexAttribArray(I),a.vertexAttribPointer(I,4,a.FLOAT,!1,0,0),a.vertexAttribDivisor(I,1);let L=a.createVertexArray();a.bindVertexArray(L),a.bindBuffer(a.ARRAY_BUFFER,D),I=a.getAttribLocation(S,`aCorner`),a.enableVertexAttribArray(I),a.vertexAttribPointer(I,2,a.FLOAT,!1,0,0),a.bindVertexArray(null);let R=a.getExtension(`EXT_color_buffer_float`),ne=R?a.RGBA16F:a.RGBA8,re=R?a.HALF_FLOAT:a.UNSIGNED_BYTE,z=[],B=(e,t)=>{let n=a.createTexture();a.bindTexture(a.TEXTURE_2D,n),a.texImage2D(a.TEXTURE_2D,0,ne,e,t,0,a.RGBA,re,null),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MIN_FILTER,a.LINEAR),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MAG_FILTER,a.LINEAR),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_S,a.CLAMP_TO_EDGE),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_T,a.CLAMP_TO_EDGE);let r=a.createFramebuffer();a.bindFramebuffer(a.FRAMEBUFFER,r),a.framebufferTexture2D(a.FRAMEBUFFER,a.COLOR_ATTACHMENT0,a.TEXTURE_2D,n,0),a.bindFramebuffer(a.FRAMEBUFFER,null);let i={fb:r,tex:n};return z.push(i),i},V=B(b,b);a.bindFramebuffer(a.FRAMEBUFFER,V.fb),a.clearColor(0,0,0,0),a.clear(a.COLOR_BUFFER_BIT),a.bindFramebuffer(a.FRAMEBUFFER,null);let H=Math.max(1,b>>2),U=B(H,H),W=B(H,H),G={time:a.getUniformLocation(x,`uTime`),r:a.getUniformLocation(x,`uR`),len:a.getUniformLocation(x,`uLen`),width:a.getUniformLocation(x,`uWidth`),aspect:a.getUniformLocation(x,`uAspect`),minWidth:a.getUniformLocation(x,`uMinWidth`),shell:a.getUniformLocation(x,`uShell`),wander:a.getUniformLocation(x,`uWander`),drift:a.getUniformLocation(x,`uDrift`),tint:a.getUniformLocation(x,`uTint`)},K={scale:a.getUniformLocation(S,`uScale`),aspect:a.getUniformLocation(S,`uAspect`),intensity:a.getUniformLocation(S,`uIntensity`),pow:a.getUniformLocation(S,`uPow`),color:a.getUniformLocation(S,`uColor`)},ie=a.getUniformLocation(C,`uFade`),q=a.getUniformLocation(T,`uDir`),J={scene:a.getUniformLocation(E,`uScene`),bloom:a.getUniformLocation(E,`uBloom`),mix:a.getUniformLocation(E,`uBloomMix`),expo:a.getUniformLocation(E,`uExpo`)},Y=e=>{a.enable(a.BLEND),a.blendFunc(a.SRC_ALPHA,a.ONE),a.bindFramebuffer(a.FRAMEBUFFER,V.fb),a.viewport(0,0,b,b),a.blendFunc(a.SRC_ALPHA,a.ONE_MINUS_SRC_ALPHA),a.useProgram(C),a.bindVertexArray(L),a.uniform1f(ie,.62),a.drawArrays(a.TRIANGLES,0,6),a.blendFunc(a.SRC_ALPHA,a.ONE),a.useProgram(S),a.bindVertexArray(L),a.uniform1f(K.aspect,1);for(let[e,t,n,r]of te)a.uniform1f(K.scale,e),a.uniform1f(K.intensity,t),a.uniform1f(K.pow,n),a.uniform3fv(K.color,r),a.drawArrays(a.TRIANGLES,0,6);a.useProgram(x),a.bindVertexArray(F),a.uniform1f(G.time,e),a.uniform1f(G.r,.62),a.uniform1f(G.len,3),a.uniform1f(G.width,.0088),a.uniform1f(G.shell,i),a.uniform1f(G.wander,h),a.uniform1f(G.drift,_),a.uniform1f(G.aspect,1),a.uniform1f(G.minWidth,1.15/b),a.uniform3fv(G.tint,n),a.drawArraysInstanced(a.TRIANGLES,0,6,O),a.disable(a.BLEND),a.bindVertexArray(L),a.bindFramebuffer(a.FRAMEBUFFER,U.fb),a.viewport(0,0,H,H),a.useProgram(w),a.activeTexture(a.TEXTURE0),a.bindTexture(a.TEXTURE_2D,V.tex),a.drawArrays(a.TRIANGLES,0,6),a.useProgram(T);for(let e=0;e<2;e++)a.bindFramebuffer(a.FRAMEBUFFER,W.fb),a.bindTexture(a.TEXTURE_2D,U.tex),a.uniform2f(q,1/H,0),a.drawArrays(a.TRIANGLES,0,6),a.bindFramebuffer(a.FRAMEBUFFER,U.fb),a.bindTexture(a.TEXTURE_2D,W.tex),a.uniform2f(q,0,1/H),a.drawArrays(a.TRIANGLES,0,6);a.bindFramebuffer(a.FRAMEBUFFER,null),a.viewport(0,0,b,b),a.useProgram(E),a.activeTexture(a.TEXTURE0),a.bindTexture(a.TEXTURE_2D,V.tex),a.uniform1i(J.scene,0),a.activeTexture(a.TEXTURE1),a.bindTexture(a.TEXTURE_2D,U.tex),a.uniform1i(J.bloom,1),a.uniform1f(J.mix,.72),a.uniform1f(J.expo,.72),a.drawArrays(a.TRIANGLES,0,6)},X=0,Z=!0,Q=new IntersectionObserver(([e])=>{Z=e.isIntersecting});Q.observe(r);let ae=()=>Z&&document.visibilityState===`visible`,$=e=>{e.preventDefault(),cancelAnimationFrame(X)};if(r.addEventListener(`webglcontextlost`,$),o)for(let e=0;e<8;e++)Y(2.5+e*.016);else{let e=performance.now(),t=n=>{X=requestAnimationFrame(t),ae()&&Y((n-e)*.001)};X=requestAnimationFrame(t)}return()=>{cancelAnimationFrame(X),Q.disconnect(),r.removeEventListener(`webglcontextlost`,$);for(let e of z)a.deleteFramebuffer(e.fb),a.deleteTexture(e.tex);a.deleteBuffer(D),a.deleteBuffer(M),a.deleteBuffer(N),a.deleteBuffer(P),a.deleteVertexArray(F),a.deleteVertexArray(L);for(let e of[x,S,w,T,E])a.deleteProgram(e)}},[e,t,n,r,i,h,_]),(0,o.jsx)(`canvas`,{ref:y,"aria-hidden":!0,className:v,style:{width:e,height:e,display:`block`}})}function v(){let[e,t]=(0,a.useState)(1);return(0,a.useEffect)(()=>{let e=setInterval(()=>t(e=>e%3+1),450);return()=>clearInterval(e)},[]),(0,o.jsx)(`span`,{className:`inline-block w-6 text-left`,children:`.`.repeat(e)})}function y(){return(0,o.jsx)(`main`,{className:`zone-dark min-h-screen bg-[#0a0a0b] px-6 py-16 text-fog`,children:(0,o.jsxs)(`div`,{className:`mx-auto flex max-w-5xl flex-col gap-14`,children:[(0,o.jsxs)(`header`,{children:[(0,o.jsx)(`p`,{className:`font-mono text-xs uppercase tracking-widest text-faint`,children:`WebGL2 · instanced streak quads · additive · bloom`}),(0,o.jsx)(`h1`,{className:`mt-3 text-4xl [font-family:var(--font-display)]`,children:`Glowing particle burst`}),(0,o.jsx)(`p`,{className:`mt-3 max-w-[62ch] leading-relaxed text-mute`,children:`A continuous radial emitter: grains fly outward from a blown-out core, each stretched along the screen projection of its own direction, so the field reads as a 3D volume rather than a flat starburst. Rebuilt in raw WebGL2 from the effect Jakub Wuzik posted.`})]}),(0,o.jsx)(`section`,{className:`relative overflow-hidden rounded-3xl border border-white/10 bg-[#101012] p-4`,children:(0,o.jsxs)(`div`,{className:`flex min-h-[420px] items-center gap-2`,children:[(0,o.jsx)(_,{size:340}),(0,o.jsxs)(`p`,{className:`-ml-6 text-4xl font-light tracking-tight text-white/85`,children:[`Calculating`,(0,o.jsx)(v,{})]})]})}),(0,o.jsxs)(`section`,{children:[(0,o.jsx)(`p`,{className:`font-mono text-xs uppercase tracking-widest text-faint`,children:`Scales down`}),(0,o.jsx)(`div`,{className:`mt-6 flex flex-wrap items-center gap-10`,children:[240,140,84,48].map(e=>(0,o.jsxs)(`div`,{className:`flex flex-col items-center gap-3`,children:[(0,o.jsx)(_,{size:e,count:e>100?1800:900}),(0,o.jsxs)(`span`,{className:`font-mono text-xs text-faint`,children:[e,`px`]})]},e))})]}),(0,o.jsxs)(`section`,{children:[(0,o.jsx)(`p`,{className:`font-mono text-xs uppercase tracking-widest text-faint`,children:`Inline, as a chip`}),(0,o.jsxs)(`div`,{className:`mt-6 flex flex-wrap items-center gap-4`,children:[(0,o.jsxs)(`span`,{className:`flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] py-1.5 pl-1 pr-4`,children:[(0,o.jsx)(_,{size:34,count:700}),(0,o.jsxs)(`span`,{className:`font-mono text-sm text-white/70`,children:[`routing 10 requests`,(0,o.jsx)(v,{})]})]}),(0,o.jsxs)(`span`,{className:`flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] py-1.5 pl-1 pr-4`,children:[(0,o.jsx)(_,{size:34,count:700,tint:[.83,.96,.45]}),(0,o.jsxs)(`span`,{className:`font-mono text-sm text-white/70`,children:[`brand tint`,(0,o.jsx)(v,{})]})]})]})]})]})})}(0,i.createRoot)(document.getElementById(`root`)).render((0,o.jsx)(a.StrictMode,{children:(0,o.jsx)(y,{})}));