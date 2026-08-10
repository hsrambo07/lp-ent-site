import{n as e,r as t,s as n,t as r}from"./jsx-runtime-M02E_j8Z.js";var i=e(),a=n(t(),1),o=r(),s=`#version 300 es
precision highp float;
in vec2 aCorner;   // -1..1 quad
in vec4 aSeed;     // xyz: unit direction, w: life phase
in vec4 aVar;      // x: life rate, y: brightness, z: <0 = infalling, w: width mul
uniform float uTime, uR, uLen, uWidth, uAspect, uMinWidth, uShell, uWander;
out vec2 vUV;
out float vBright;

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

/* Position at life t. Two populations share one birth shell:
   infalling grains accelerate off the shell, peak mid-fall and decelerate
   into the core; ejected grains leave fast and decelerate into the rim.
   Both ride the shared curl field (the Turbulence Field move). */
vec3 particlePos(float t, vec3 dir, float infall, float seed) {
  float r = infall > 0.5
    ? mix(uShell, 0.05, smoothstep(0.0, 1.0, t))   // velocity peaks mid-fall
    : mix(uShell, 1.0, 1.0 - pow(1.0 - t, 3.2));   // fast off the shell, then stalls
  vec3 base = dir * r;
  // wavelength ≈ 0.4R (freq 5/R on unit sphere), amplitude ≤ 0.3 × wavelength,
  // evolution over seconds — the coherence numbers that read as fluid.
  vec3 swirl = curl(base * 5.0 + vec3(0.0, uTime * 0.16, uTime * 0.11));
  float env = smoothstep(0.0, 0.15, t) * smoothstep(0.08, 0.35, r) * (1.0 - 0.7 * smoothstep(0.7, 1.0, r));
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
  float dt = 0.018;
  vec3 p0 = particlePos(t, dir, infall, aSeed.w);
  vec3 p1 = particlePos(t + dt, dir, infall, aSeed.w);

  vec3 pm = mix(p0, p1, 0.5);
  float persp = 2.6 / (2.6 - pm.z);
  vec2 s0 = p0.xy * (2.6 / (2.6 - p0.z));
  vec2 s1 = p1.xy * (2.6 / (2.6 - p1.z));
  vec2 seg = s1 - s0;
  float segLen = length(seg);
  vec2 sdir = segLen > 1e-6 ? seg / segLen : vec2(1.0, 0.0);

  float wid0 = uWidth * aVar.w * persp;
  // Cap the stretch: reference grains run median aspect 1.45, p90 ~3.
  float len = clamp(segLen * uLen * lenMul, wid0 * 1.1, wid0 * 3.4);
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
  float birth = smoothstep(0.0, 0.06, t);
  // Ejected grains reach the rim early and then sit there fading, which is
  // why the reference's outer halo measures as motionless.
  float death = 1.0 - smoothstep(infall > 0.5 ? 0.88 : 0.55, 1.0, t);
  float flick = 0.84 + 0.16 * sin(uTime * 6.2831 * (0.2 + 0.6 * fract(aSeed.w * 7.31)) + aSeed.w * 43.0);
  // Density goes as 1/r², so grains stack up and clip to white near the middle.
  float nearCore = 1.0 + 4.0 * exp(-r / 0.24);
  vBright = birth * death * aVar.y * flick * nearCore * (0.55 + 0.30 * persp);
}`,c=`#version 300 es
precision highp float;
in vec2 vUV;
in float vBright;
uniform vec3 uTint;
out vec4 outColor;
void main(){
  // Elongated gaussian: the reference's grains are soft blobs (median aspect
  // 1.45, edge-hardness 0.43 measured), not hard capsules.
  float m = exp(-(vUV.x * vUV.x * 3.6 + vUV.y * vUV.y * 2.0));
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
  outColor = vec4(c * smoothstep(0.2, 0.75, dot(c, vec3(0.299, 0.587, 0.114))), 1.0);
}`,ee=`#version 300 es
precision highp float;
in vec2 vUV; uniform sampler2D uTex; uniform vec2 uDir; out vec4 outColor;
void main(){
  vec3 s = texture(uTex, vUV).rgb * 0.2270270270;
  s += (texture(uTex, vUV + uDir * 1.3846153846).rgb
     +  texture(uTex, vUV - uDir * 1.3846153846).rgb) * 0.3162162162;
  s += (texture(uTex, vUV + uDir * 3.2307692308).rgb
     +  texture(uTex, vUV - uDir * 3.2307692308).rgb) * 0.0702702703;
  outColor = vec4(s, 1.0);
}`,m=`#version 300 es
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
}`,h=[[.74,.06,3,[.56,.68,1]],[.5,.16,2.2,[.7,.81,1]],[.32,.55,2.3,[.86,.92,1]],[.23,1.9,2,[.97,.98,1]],[.125,3.6,1.6,[1,1,1]]];function g(e,t,n){let r=e.createShader(t);if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS))throw Error(e.getShaderInfoLog(r)??`compile failed`);return r}function _(e,t,n){let r=e.createProgram();if(e.attachShader(r,g(e,e.VERTEX_SHADER,t)),e.attachShader(r,g(e,e.FRAGMENT_SHADER,n)),e.linkProgram(r),!e.getProgramParameter(r,e.LINK_STATUS))throw Error(e.getProgramInfoLog(r)??`link failed`);return r}function v({size:e=220,count:t=3200,tint:n=[.72,.82,1],infallFraction:r=.5,shell:i=.5,wander:g=.022,className:v}){let y=(0,a.useRef)(null);return(0,a.useEffect)(()=>{let a=y.current;if(!a)return;let o=a.getContext(`webgl2`,{alpha:!0,antialias:!1,premultipliedAlpha:!0});if(!o){a.style.background=`radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(190,215,255,0.35) 18%, rgba(120,150,220,0.10) 42%, transparent 70%)`;return}let v=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches,b=Math.min(window.devicePixelRatio||1,2),x=Math.round(e*b);a.width=x,a.height=x;let S=_(o,s,c),C=_(o,l,u),w=_(o,d,f),T=_(o,d,p),E=_(o,d,ee),D=_(o,d,m),O=o.createBuffer();o.bindBuffer(o.ARRAY_BUFFER,O),o.bufferData(o.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),o.STATIC_DRAW);let k=new Float32Array(t*4),A=new Float32Array(t*4);for(let e=0;e<t;e++){let t=Math.random()*2-1,n=Math.random()*Math.PI*2,i=Math.sqrt(1-t*t);k[e*4]=i*Math.cos(n),k[e*4+1]=i*Math.sin(n),k[e*4+2]=t,k[e*4+3]=Math.random();let a=Math.random();A[e*4]=.066*(.75+Math.random()*.6),A[e*4+1]=.3+a*a*1.4;let o=.5+Math.random()*1.2;A[e*4+2]=Math.random()<r?-o:o,A[e*4+3]=.7+Math.random()*.8}let j=o.createBuffer();o.bindBuffer(o.ARRAY_BUFFER,j),o.bufferData(o.ARRAY_BUFFER,k,o.STATIC_DRAW);let M=o.createBuffer();o.bindBuffer(o.ARRAY_BUFFER,M),o.bufferData(o.ARRAY_BUFFER,A,o.STATIC_DRAW);let N=o.createVertexArray();o.bindVertexArray(N),o.bindBuffer(o.ARRAY_BUFFER,O);let P=o.getAttribLocation(S,`aCorner`);o.enableVertexAttribArray(P),o.vertexAttribPointer(P,2,o.FLOAT,!1,0,0),o.bindBuffer(o.ARRAY_BUFFER,j),P=o.getAttribLocation(S,`aSeed`),o.enableVertexAttribArray(P),o.vertexAttribPointer(P,4,o.FLOAT,!1,0,0),o.vertexAttribDivisor(P,1),o.bindBuffer(o.ARRAY_BUFFER,M),P=o.getAttribLocation(S,`aVar`),o.enableVertexAttribArray(P),o.vertexAttribPointer(P,4,o.FLOAT,!1,0,0),o.vertexAttribDivisor(P,1);let F=o.createVertexArray();o.bindVertexArray(F),o.bindBuffer(o.ARRAY_BUFFER,O),P=o.getAttribLocation(C,`aCorner`),o.enableVertexAttribArray(P),o.vertexAttribPointer(P,2,o.FLOAT,!1,0,0),o.bindVertexArray(null);let I=o.getExtension(`EXT_color_buffer_float`),L=I?o.RGBA16F:o.RGBA8,R=I?o.HALF_FLOAT:o.UNSIGNED_BYTE,z=[],B=(e,t)=>{let n=o.createTexture();o.bindTexture(o.TEXTURE_2D,n),o.texImage2D(o.TEXTURE_2D,0,L,e,t,0,o.RGBA,R,null),o.texParameteri(o.TEXTURE_2D,o.TEXTURE_MIN_FILTER,o.LINEAR),o.texParameteri(o.TEXTURE_2D,o.TEXTURE_MAG_FILTER,o.LINEAR),o.texParameteri(o.TEXTURE_2D,o.TEXTURE_WRAP_S,o.CLAMP_TO_EDGE),o.texParameteri(o.TEXTURE_2D,o.TEXTURE_WRAP_T,o.CLAMP_TO_EDGE);let r=o.createFramebuffer();o.bindFramebuffer(o.FRAMEBUFFER,r),o.framebufferTexture2D(o.FRAMEBUFFER,o.COLOR_ATTACHMENT0,o.TEXTURE_2D,n,0),o.bindFramebuffer(o.FRAMEBUFFER,null);let i={fb:r,tex:n};return z.push(i),i},V=B(x,x);o.bindFramebuffer(o.FRAMEBUFFER,V.fb),o.clearColor(0,0,0,0),o.clear(o.COLOR_BUFFER_BIT),o.bindFramebuffer(o.FRAMEBUFFER,null);let H=Math.max(1,x>>2),U=B(H,H),W=B(H,H),G={time:o.getUniformLocation(S,`uTime`),r:o.getUniformLocation(S,`uR`),len:o.getUniformLocation(S,`uLen`),width:o.getUniformLocation(S,`uWidth`),aspect:o.getUniformLocation(S,`uAspect`),minWidth:o.getUniformLocation(S,`uMinWidth`),shell:o.getUniformLocation(S,`uShell`),wander:o.getUniformLocation(S,`uWander`),tint:o.getUniformLocation(S,`uTint`)},K={scale:o.getUniformLocation(C,`uScale`),aspect:o.getUniformLocation(C,`uAspect`),intensity:o.getUniformLocation(C,`uIntensity`),pow:o.getUniformLocation(C,`uPow`),color:o.getUniformLocation(C,`uColor`)},te=o.getUniformLocation(w,`uFade`),q=o.getUniformLocation(E,`uDir`),J={scene:o.getUniformLocation(D,`uScene`),bloom:o.getUniformLocation(D,`uBloom`),mix:o.getUniformLocation(D,`uBloomMix`),expo:o.getUniformLocation(D,`uExpo`)},Y=e=>{o.enable(o.BLEND),o.blendFunc(o.SRC_ALPHA,o.ONE),o.bindFramebuffer(o.FRAMEBUFFER,V.fb),o.viewport(0,0,x,x),o.blendFunc(o.SRC_ALPHA,o.ONE_MINUS_SRC_ALPHA),o.useProgram(w),o.bindVertexArray(F),o.uniform1f(te,.36),o.drawArrays(o.TRIANGLES,0,6),o.blendFunc(o.SRC_ALPHA,o.ONE),o.useProgram(C),o.bindVertexArray(F),o.uniform1f(K.aspect,1);for(let[e,t,n,r]of h)o.uniform1f(K.scale,e),o.uniform1f(K.intensity,t),o.uniform1f(K.pow,n),o.uniform3fv(K.color,r),o.drawArrays(o.TRIANGLES,0,6);o.useProgram(S),o.bindVertexArray(N),o.uniform1f(G.time,e),o.uniform1f(G.r,.62),o.uniform1f(G.len,3.4),o.uniform1f(G.width,.015),o.uniform1f(G.shell,i),o.uniform1f(G.wander,g),o.uniform1f(G.aspect,1),o.uniform1f(G.minWidth,1.15/x),o.uniform3fv(G.tint,n),o.drawArraysInstanced(o.TRIANGLES,0,6,t),o.disable(o.BLEND),o.bindVertexArray(F),o.bindFramebuffer(o.FRAMEBUFFER,U.fb),o.viewport(0,0,H,H),o.useProgram(T),o.activeTexture(o.TEXTURE0),o.bindTexture(o.TEXTURE_2D,V.tex),o.drawArrays(o.TRIANGLES,0,6),o.useProgram(E);for(let e=0;e<3;e++)o.bindFramebuffer(o.FRAMEBUFFER,W.fb),o.bindTexture(o.TEXTURE_2D,U.tex),o.uniform2f(q,1/H,0),o.drawArrays(o.TRIANGLES,0,6),o.bindFramebuffer(o.FRAMEBUFFER,U.fb),o.bindTexture(o.TEXTURE_2D,W.tex),o.uniform2f(q,0,1/H),o.drawArrays(o.TRIANGLES,0,6);o.bindFramebuffer(o.FRAMEBUFFER,null),o.viewport(0,0,x,x),o.useProgram(D),o.activeTexture(o.TEXTURE0),o.bindTexture(o.TEXTURE_2D,V.tex),o.uniform1i(J.scene,0),o.activeTexture(o.TEXTURE1),o.bindTexture(o.TEXTURE_2D,U.tex),o.uniform1i(J.bloom,1),o.uniform1f(J.mix,1.5),o.uniform1f(J.expo,.36),o.drawArrays(o.TRIANGLES,0,6)},X=0,Z=!0,Q=new IntersectionObserver(([e])=>{Z=e.isIntersecting});Q.observe(a);let ne=()=>Z&&document.visibilityState===`visible`,$=e=>{e.preventDefault(),cancelAnimationFrame(X)};if(a.addEventListener(`webglcontextlost`,$),v)for(let e=0;e<8;e++)Y(2.5+e*.016);else{let e=performance.now(),t=n=>{X=requestAnimationFrame(t),ne()&&Y((n-e)*.001)};X=requestAnimationFrame(t)}return()=>{cancelAnimationFrame(X),Q.disconnect(),a.removeEventListener(`webglcontextlost`,$);for(let e of z)o.deleteFramebuffer(e.fb),o.deleteTexture(e.tex);o.deleteBuffer(O),o.deleteBuffer(j),o.deleteBuffer(M),o.deleteVertexArray(N),o.deleteVertexArray(F);for(let e of[S,C,T,E,D])o.deleteProgram(e)}},[e,t,n,r,i,g]),(0,o.jsx)(`canvas`,{ref:y,"aria-hidden":!0,className:v,style:{width:e,height:e,display:`block`}})}function y(){let[e,t]=(0,a.useState)(1);return(0,a.useEffect)(()=>{let e=setInterval(()=>t(e=>e%3+1),450);return()=>clearInterval(e)},[]),(0,o.jsx)(`span`,{className:`inline-block w-6 text-left`,children:`.`.repeat(e)})}function b(){return(0,o.jsx)(`main`,{className:`zone-dark min-h-screen bg-[#0a0a0b] px-6 py-16 text-fog`,children:(0,o.jsxs)(`div`,{className:`mx-auto flex max-w-5xl flex-col gap-14`,children:[(0,o.jsxs)(`header`,{children:[(0,o.jsx)(`p`,{className:`font-mono text-xs uppercase tracking-widest text-faint`,children:`WebGL2 · instanced streak quads · additive · bloom`}),(0,o.jsx)(`h1`,{className:`mt-3 text-4xl [font-family:var(--font-display)]`,children:`Glowing particle burst`}),(0,o.jsx)(`p`,{className:`mt-3 max-w-[62ch] leading-relaxed text-mute`,children:`A continuous radial emitter: grains fly outward from a blown-out core, each stretched along the screen projection of its own direction, so the field reads as a 3D volume rather than a flat starburst. Rebuilt in raw WebGL2 from the effect Jakub Wuzik posted.`})]}),(0,o.jsx)(`section`,{className:`relative overflow-hidden rounded-3xl border border-white/10 bg-[#101012] p-4`,children:(0,o.jsxs)(`div`,{className:`flex min-h-[420px] items-center gap-2`,children:[(0,o.jsx)(v,{size:340}),(0,o.jsxs)(`p`,{className:`-ml-6 text-4xl font-light tracking-tight text-white/85`,children:[`Calculating`,(0,o.jsx)(y,{})]})]})}),(0,o.jsxs)(`section`,{children:[(0,o.jsx)(`p`,{className:`font-mono text-xs uppercase tracking-widest text-faint`,children:`Scales down`}),(0,o.jsx)(`div`,{className:`mt-6 flex flex-wrap items-center gap-10`,children:[240,140,84,48].map(e=>(0,o.jsxs)(`div`,{className:`flex flex-col items-center gap-3`,children:[(0,o.jsx)(v,{size:e,count:e>100?1800:900}),(0,o.jsxs)(`span`,{className:`font-mono text-xs text-faint`,children:[e,`px`]})]},e))})]}),(0,o.jsxs)(`section`,{children:[(0,o.jsx)(`p`,{className:`font-mono text-xs uppercase tracking-widest text-faint`,children:`Inline, as a chip`}),(0,o.jsxs)(`div`,{className:`mt-6 flex flex-wrap items-center gap-4`,children:[(0,o.jsxs)(`span`,{className:`flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] py-1.5 pl-1 pr-4`,children:[(0,o.jsx)(v,{size:34,count:700}),(0,o.jsxs)(`span`,{className:`font-mono text-sm text-white/70`,children:[`routing 10 requests`,(0,o.jsx)(y,{})]})]}),(0,o.jsxs)(`span`,{className:`flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] py-1.5 pl-1 pr-4`,children:[(0,o.jsx)(v,{size:34,count:700,tint:[.83,.96,.45]}),(0,o.jsxs)(`span`,{className:`font-mono text-sm text-white/70`,children:[`brand tint`,(0,o.jsx)(y,{})]})]})]})]})]})})}(0,i.createRoot)(document.getElementById(`root`)).render((0,o.jsx)(a.StrictMode,{children:(0,o.jsx)(b,{})}));