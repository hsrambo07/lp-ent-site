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

/* Position at life t. Two populations share one birth shell:
   infalling grains accelerate off the shell, peak mid-fall and decelerate
   into the core; ejected grains leave fast and decelerate into the rim.
   Both carry an incoherent lateral wander (turbulence, not spin). */
vec3 particlePos(float t, vec3 dir, vec3 pa, vec3 pb, float infall, float seed) {
  float r = infall > 0.5
    ? mix(uShell, 0.05, smoothstep(0.0, 1.0, t))   // velocity peaks mid-fall
    : mix(uShell, 1.0, 1.0 - pow(1.0 - t, 3.2));   // fast off the shell, then stalls
  vec3 wob = pa * sin(t * 3.0 + seed * 41.0) + pb * cos(t * 2.6 + seed * 27.0);
  return (dir * r + wob * uWander * r) * uR;
}

void main(){
  float t = fract(uTime * aVar.x + aSeed.w);
  vec3 dir = rotY(uTime * 0.13) * rotX(sin(uTime * 0.09) * 0.25) * aSeed.xyz;
  float infall = aVar.z < 0.0 ? 1.0 : 0.0;
  float lenMul = abs(aVar.z);

  // a stable basis perpendicular to dir, for the lateral wander
  vec3 pa = normalize(cross(dir, vec3(0.31, 0.72, 0.62)));
  vec3 pb = cross(dir, pa);

  // Sample the path twice: the streak IS the motion blur, so its axis and
  // length come from actual displacement. Foreshortening then falls out for
  // free — a grain flying at the camera barely moves in screen space.
  float dt = 0.018;
  vec3 p0 = particlePos(t, dir, pa, pb, infall, aSeed.w);
  vec3 p1 = particlePos(t + dt, dir, pa, pb, infall, aSeed.w);

  vec3 pm = mix(p0, p1, 0.5);
  float persp = 2.6 / (2.6 - pm.z);
  vec2 s0 = p0.xy * (2.6 / (2.6 - p0.z));
  vec2 s1 = p1.xy * (2.6 / (2.6 - p1.z));
  vec2 seg = s1 - s0;
  float segLen = length(seg);
  vec2 sdir = segLen > 1e-6 ? seg / segLen : vec2(1.0, 0.0);

  float len = max(segLen * uLen * lenMul, uMinWidth * 1.6);
  // Floor the width in device pixels. Sub-pixel grains alias into a
  // shimmering mess at small sizes and on low-DPR screens.
  float wid = max(uWidth * aVar.w * persp, uMinWidth);

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
  float flick = 0.75 + 0.45 * sin(uTime * 5.0 + aSeed.w * 43.0);
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
  float a = 1.0 - smoothstep(0.0, 1.0, abs(vUV.x));
  float b = 1.0 - smoothstep(0.0, 1.0, abs(vUV.y));
  float m = pow(a, 2.1) * pow(b, 1.7);
  if (m < 0.004) discard;
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
in vec2 vUV; uniform sampler2D uTex; out vec4 outColor;
void main(){
  vec3 c = texture(uTex, vUV).rgb;
  outColor = vec4(c * smoothstep(0.28, 0.9, dot(c, vec3(0.299, 0.587, 0.114))), 1.0);
}`,p=`#version 300 es
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
}`,h=[[.72,.035,3,[.56,.68,1]],[.46,.075,2.4,[.7,.81,1]],[.3,.42,2.4,[.86,.92,1]],[.23,1.9,2,[.97,.98,1]],[.125,3.6,1.6,[1,1,1]]];function g(e,t,n){let r=e.createShader(t);if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS))throw Error(e.getShaderInfoLog(r)??`compile failed`);return r}function _(e,t,n){let r=e.createProgram();if(e.attachShader(r,g(e,e.VERTEX_SHADER,t)),e.attachShader(r,g(e,e.FRAGMENT_SHADER,n)),e.linkProgram(r),!e.getProgramParameter(r,e.LINK_STATUS))throw Error(e.getProgramInfoLog(r)??`link failed`);return r}function v({size:e=220,count:t=2600,tint:n=[.72,.82,1],infallFraction:r=.5,shell:i=.5,wander:g=.1,className:v}){let y=(0,a.useRef)(null);return(0,a.useEffect)(()=>{let a=y.current;if(!a)return;let o=a.getContext(`webgl2`,{alpha:!0,antialias:!1,premultipliedAlpha:!0});if(!o){a.style.background=`radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(190,215,255,0.35) 18%, rgba(120,150,220,0.10) 42%, transparent 70%)`;return}let v=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches,b=Math.min(window.devicePixelRatio||1,2),x=Math.round(e*b);a.width=x,a.height=x;let S=_(o,s,c),C=_(o,l,u),w=_(o,d,f),T=_(o,d,p),E=_(o,d,m),D=o.createBuffer();o.bindBuffer(o.ARRAY_BUFFER,D),o.bufferData(o.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),o.STATIC_DRAW);let O=new Float32Array(t*4),k=new Float32Array(t*4);for(let e=0;e<t;e++){let t=Math.random()*2-1,n=Math.random()*Math.PI*2,i=Math.sqrt(1-t*t);O[e*4]=i*Math.cos(n),O[e*4+1]=i*Math.sin(n),O[e*4+2]=t,O[e*4+3]=Math.random();let a=Math.random();k[e*4]=.1*(.75+Math.random()*.6),k[e*4+1]=.14+a*a*a*3;let o=.5+Math.random()*1.2;k[e*4+2]=Math.random()<r?-o:o,k[e*4+3]=.7+Math.random()*.8}let A=o.createBuffer();o.bindBuffer(o.ARRAY_BUFFER,A),o.bufferData(o.ARRAY_BUFFER,O,o.STATIC_DRAW);let j=o.createBuffer();o.bindBuffer(o.ARRAY_BUFFER,j),o.bufferData(o.ARRAY_BUFFER,k,o.STATIC_DRAW);let M=o.createVertexArray();o.bindVertexArray(M),o.bindBuffer(o.ARRAY_BUFFER,D);let N=o.getAttribLocation(S,`aCorner`);o.enableVertexAttribArray(N),o.vertexAttribPointer(N,2,o.FLOAT,!1,0,0),o.bindBuffer(o.ARRAY_BUFFER,A),N=o.getAttribLocation(S,`aSeed`),o.enableVertexAttribArray(N),o.vertexAttribPointer(N,4,o.FLOAT,!1,0,0),o.vertexAttribDivisor(N,1),o.bindBuffer(o.ARRAY_BUFFER,j),N=o.getAttribLocation(S,`aVar`),o.enableVertexAttribArray(N),o.vertexAttribPointer(N,4,o.FLOAT,!1,0,0),o.vertexAttribDivisor(N,1);let P=o.createVertexArray();o.bindVertexArray(P),o.bindBuffer(o.ARRAY_BUFFER,D),N=o.getAttribLocation(C,`aCorner`),o.enableVertexAttribArray(N),o.vertexAttribPointer(N,2,o.FLOAT,!1,0,0),o.bindVertexArray(null);let F=o.getExtension(`EXT_color_buffer_float`),I=F?o.RGBA16F:o.RGBA8,L=F?o.HALF_FLOAT:o.UNSIGNED_BYTE,R=[],z=(e,t)=>{let n=o.createTexture();o.bindTexture(o.TEXTURE_2D,n),o.texImage2D(o.TEXTURE_2D,0,I,e,t,0,o.RGBA,L,null),o.texParameteri(o.TEXTURE_2D,o.TEXTURE_MIN_FILTER,o.LINEAR),o.texParameteri(o.TEXTURE_2D,o.TEXTURE_MAG_FILTER,o.LINEAR),o.texParameteri(o.TEXTURE_2D,o.TEXTURE_WRAP_S,o.CLAMP_TO_EDGE),o.texParameteri(o.TEXTURE_2D,o.TEXTURE_WRAP_T,o.CLAMP_TO_EDGE);let r=o.createFramebuffer();o.bindFramebuffer(o.FRAMEBUFFER,r),o.framebufferTexture2D(o.FRAMEBUFFER,o.COLOR_ATTACHMENT0,o.TEXTURE_2D,n,0),o.bindFramebuffer(o.FRAMEBUFFER,null);let i={fb:r,tex:n};return R.push(i),i},B=z(x,x),V=Math.max(1,x>>2),H=z(V,V),U=z(V,V),W={time:o.getUniformLocation(S,`uTime`),r:o.getUniformLocation(S,`uR`),len:o.getUniformLocation(S,`uLen`),width:o.getUniformLocation(S,`uWidth`),aspect:o.getUniformLocation(S,`uAspect`),minWidth:o.getUniformLocation(S,`uMinWidth`),shell:o.getUniformLocation(S,`uShell`),wander:o.getUniformLocation(S,`uWander`),tint:o.getUniformLocation(S,`uTint`)},G={scale:o.getUniformLocation(C,`uScale`),aspect:o.getUniformLocation(C,`uAspect`),intensity:o.getUniformLocation(C,`uIntensity`),pow:o.getUniformLocation(C,`uPow`),color:o.getUniformLocation(C,`uColor`)},K=o.getUniformLocation(T,`uDir`),q={scene:o.getUniformLocation(E,`uScene`),bloom:o.getUniformLocation(E,`uBloom`),mix:o.getUniformLocation(E,`uBloomMix`),expo:o.getUniformLocation(E,`uExpo`)},J=e=>{o.enable(o.BLEND),o.blendFunc(o.SRC_ALPHA,o.ONE),o.bindFramebuffer(o.FRAMEBUFFER,B.fb),o.viewport(0,0,x,x),o.clearColor(0,0,0,0),o.clear(o.COLOR_BUFFER_BIT),o.useProgram(C),o.bindVertexArray(P),o.uniform1f(G.aspect,1);for(let[e,t,n,r]of h)o.uniform1f(G.scale,e),o.uniform1f(G.intensity,t),o.uniform1f(G.pow,n),o.uniform3fv(G.color,r),o.drawArrays(o.TRIANGLES,0,6);o.useProgram(S),o.bindVertexArray(M),o.uniform1f(W.time,e),o.uniform1f(W.r,.62),o.uniform1f(W.len,6),o.uniform1f(W.width,.0092),o.uniform1f(W.shell,i),o.uniform1f(W.wander,g),o.uniform1f(W.aspect,1),o.uniform1f(W.minWidth,1.15/x),o.uniform3fv(W.tint,n),o.drawArraysInstanced(o.TRIANGLES,0,6,t),o.disable(o.BLEND),o.bindVertexArray(P),o.bindFramebuffer(o.FRAMEBUFFER,H.fb),o.viewport(0,0,V,V),o.useProgram(w),o.activeTexture(o.TEXTURE0),o.bindTexture(o.TEXTURE_2D,B.tex),o.drawArrays(o.TRIANGLES,0,6),o.useProgram(T);for(let e=0;e<2;e++)o.bindFramebuffer(o.FRAMEBUFFER,U.fb),o.bindTexture(o.TEXTURE_2D,H.tex),o.uniform2f(K,1/V,0),o.drawArrays(o.TRIANGLES,0,6),o.bindFramebuffer(o.FRAMEBUFFER,H.fb),o.bindTexture(o.TEXTURE_2D,U.tex),o.uniform2f(K,0,1/V),o.drawArrays(o.TRIANGLES,0,6);o.bindFramebuffer(o.FRAMEBUFFER,null),o.viewport(0,0,x,x),o.useProgram(E),o.activeTexture(o.TEXTURE0),o.bindTexture(o.TEXTURE_2D,B.tex),o.uniform1i(q.scene,0),o.activeTexture(o.TEXTURE1),o.bindTexture(o.TEXTURE_2D,H.tex),o.uniform1i(q.bloom,1),o.uniform1f(q.mix,1.15),o.uniform1f(q.expo,1.1),o.drawArrays(o.TRIANGLES,0,6)},Y=0,X=!0,Z=new IntersectionObserver(([e])=>{X=e.isIntersecting});Z.observe(a);let Q=()=>X&&document.visibilityState===`visible`,$=e=>{e.preventDefault(),cancelAnimationFrame(Y)};if(a.addEventListener(`webglcontextlost`,$),v)J(2.5);else{let e=performance.now(),t=n=>{Y=requestAnimationFrame(t),Q()&&J((n-e)*.001)};Y=requestAnimationFrame(t)}return()=>{cancelAnimationFrame(Y),Z.disconnect(),a.removeEventListener(`webglcontextlost`,$);for(let e of R)o.deleteFramebuffer(e.fb),o.deleteTexture(e.tex);o.deleteBuffer(D),o.deleteBuffer(A),o.deleteBuffer(j),o.deleteVertexArray(M),o.deleteVertexArray(P);for(let e of[S,C,w,T,E])o.deleteProgram(e)}},[e,t,n,r,i,g]),(0,o.jsx)(`canvas`,{ref:y,"aria-hidden":!0,className:v,style:{width:e,height:e,display:`block`}})}function y(){let[e,t]=(0,a.useState)(1);return(0,a.useEffect)(()=>{let e=setInterval(()=>t(e=>e%3+1),450);return()=>clearInterval(e)},[]),(0,o.jsx)(`span`,{className:`inline-block w-6 text-left`,children:`.`.repeat(e)})}function b(){return(0,o.jsx)(`main`,{className:`zone-dark min-h-screen bg-[#0a0a0b] px-6 py-16 text-fog`,children:(0,o.jsxs)(`div`,{className:`mx-auto flex max-w-5xl flex-col gap-14`,children:[(0,o.jsxs)(`header`,{children:[(0,o.jsx)(`p`,{className:`font-mono text-xs uppercase tracking-widest text-faint`,children:`WebGL2 · instanced streak quads · additive · bloom`}),(0,o.jsx)(`h1`,{className:`mt-3 text-4xl [font-family:var(--font-display)]`,children:`Glowing particle burst`}),(0,o.jsx)(`p`,{className:`mt-3 max-w-[62ch] leading-relaxed text-mute`,children:`A continuous radial emitter: grains fly outward from a blown-out core, each stretched along the screen projection of its own direction, so the field reads as a 3D volume rather than a flat starburst. Rebuilt in raw WebGL2 from the effect Jakub Wuzik posted.`})]}),(0,o.jsx)(`section`,{className:`relative overflow-hidden rounded-3xl border border-white/10 bg-[#101012] p-4`,children:(0,o.jsxs)(`div`,{className:`flex min-h-[420px] items-center gap-2`,children:[(0,o.jsx)(v,{size:340}),(0,o.jsxs)(`p`,{className:`-ml-6 text-4xl font-light tracking-tight text-white/85`,children:[`Calculating`,(0,o.jsx)(y,{})]})]})}),(0,o.jsxs)(`section`,{children:[(0,o.jsx)(`p`,{className:`font-mono text-xs uppercase tracking-widest text-faint`,children:`Scales down`}),(0,o.jsx)(`div`,{className:`mt-6 flex flex-wrap items-center gap-10`,children:[240,140,84,48].map(e=>(0,o.jsxs)(`div`,{className:`flex flex-col items-center gap-3`,children:[(0,o.jsx)(v,{size:e,count:e>100?1800:900}),(0,o.jsxs)(`span`,{className:`font-mono text-xs text-faint`,children:[e,`px`]})]},e))})]}),(0,o.jsxs)(`section`,{children:[(0,o.jsx)(`p`,{className:`font-mono text-xs uppercase tracking-widest text-faint`,children:`Inline, as a chip`}),(0,o.jsxs)(`div`,{className:`mt-6 flex flex-wrap items-center gap-4`,children:[(0,o.jsxs)(`span`,{className:`flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] py-1.5 pl-1 pr-4`,children:[(0,o.jsx)(v,{size:34,count:700}),(0,o.jsxs)(`span`,{className:`font-mono text-sm text-white/70`,children:[`routing 10 requests`,(0,o.jsx)(y,{})]})]}),(0,o.jsxs)(`span`,{className:`flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] py-1.5 pl-1 pr-4`,children:[(0,o.jsx)(v,{size:34,count:700,tint:[.83,.96,.45]}),(0,o.jsxs)(`span`,{className:`font-mono text-sm text-white/70`,children:[`brand tint`,(0,o.jsx)(y,{})]})]})]})]})]})})}(0,i.createRoot)(document.getElementById(`root`)).render((0,o.jsx)(a.StrictMode,{children:(0,o.jsx)(b,{})}));