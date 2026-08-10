import{n as e,r as t,s as n,t as r}from"./jsx-runtime-Dr408h20.js";var i=e(),a=n(t(),1),o=r(),s=`#version 300 es
precision highp float;
in vec2 aCorner;   // -1..1 quad
in vec4 aSeed;     // xyz: unit direction, w: life phase
in vec4 aVar;      // x: life rate, y: brightness, z: length mul, w: width mul
uniform float uTime, uR, uLen, uWidth, uAspect, uMinWidth;
out vec2 vUV;
out float vBright;

mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1.,0.,0., 0.,c,-s, 0.,s,c); }

void main(){
  float t = fract(uTime * aVar.x + aSeed.w);
  vec3 dir = rotY(uTime * 0.13) * rotX(sin(uTime * 0.09) * 0.25) * aSeed.xyz;

  // Outward flight, decelerating. The low exponent keeps grains in the outer
  // shell for most of their life so the disc fills instead of piling up.
  float r = uR * (0.20 + 0.80 * pow(t, 0.42));
  float speed = 0.75 + 0.45 * min(pow(max(t, 0.08), -0.4), 1.6);

  vec3 p = dir * r;
  float persp = 2.6 / (2.6 - p.z);
  vec2 sp = p.xy * persp;
  vec2 sdir = normalize(dir.xy * persp + vec2(1e-5));

  // Foreshortening: length follows the projected direction, so grains aimed
  // at the camera collapse to dots. This is the 3D cue.
  float fore = length(dir.xy);
  float len = uLen * speed * aVar.z * persp * (0.30 + 0.70 * fore);
  // Floor the width in device pixels. Sub-pixel grains alias into a
  // shimmering mess at small sizes and on low-DPR screens.
  float wid = max(uWidth * aVar.w * persp, uMinWidth);

  vec2 pos = sp + sdir * (aCorner.y * len) + vec2(-sdir.y, sdir.x) * (aCorner.x * wid);
  pos.x /= uAspect;
  gl_Position = vec4(pos, 0.0, 1.0);
  vUV = aCorner;

  float birth = smoothstep(0.0, 0.04, t);
  float death = 1.0 - smoothstep(0.78, 1.0, t);
  float flick = 0.75 + 0.45 * sin(uTime * 5.0 + aSeed.w * 43.0);
  float nearCore = 1.0 + 4.0 * exp(-r / (uR * 0.24));
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
}`,h=[[.72,.035,3,[.56,.68,1]],[.46,.075,2.4,[.7,.81,1]],[.3,.42,2.4,[.86,.92,1]],[.19,1.6,1.9,[.97,.98,1]],[.1,3.6,1.5,[1,1,1]]];function g(e,t,n){let r=e.createShader(t);if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS))throw Error(e.getShaderInfoLog(r)??`compile failed`);return r}function _(e,t,n){let r=e.createProgram();if(e.attachShader(r,g(e,e.VERTEX_SHADER,t)),e.attachShader(r,g(e,e.FRAGMENT_SHADER,n)),e.linkProgram(r),!e.getProgramParameter(r,e.LINK_STATUS))throw Error(e.getProgramInfoLog(r)??`link failed`);return r}function v({size:e=220,count:t=1800,tint:n=[.72,.82,1],className:r}){let i=(0,a.useRef)(null);return(0,a.useEffect)(()=>{let r=i.current;if(!r)return;let a=r.getContext(`webgl2`,{alpha:!0,antialias:!1,premultipliedAlpha:!0});if(!a){r.style.background=`radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(190,215,255,0.35) 18%, rgba(120,150,220,0.10) 42%, transparent 70%)`;return}let o=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches,g=Math.min(window.devicePixelRatio||1,2),v=Math.round(e*g);r.width=v,r.height=v;let y=_(a,s,c),b=_(a,l,u),x=_(a,d,f),S=_(a,d,p),C=_(a,d,m),w=a.createBuffer();a.bindBuffer(a.ARRAY_BUFFER,w),a.bufferData(a.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),a.STATIC_DRAW);let T=new Float32Array(t*4),E=new Float32Array(t*4);for(let e=0;e<t;e++){let t=Math.random()*2-1,n=Math.random()*Math.PI*2,r=Math.sqrt(1-t*t);T[e*4]=r*Math.cos(n),T[e*4+1]=r*Math.sin(n),T[e*4+2]=t,T[e*4+3]=Math.random();let i=Math.random();E[e*4]=.26*(.75+Math.random()*.6),E[e*4+1]=.1+i*i*i*2.6,E[e*4+2]=.5+Math.random()*1.2,E[e*4+3]=.7+Math.random()*.8}let D=a.createBuffer();a.bindBuffer(a.ARRAY_BUFFER,D),a.bufferData(a.ARRAY_BUFFER,T,a.STATIC_DRAW);let O=a.createBuffer();a.bindBuffer(a.ARRAY_BUFFER,O),a.bufferData(a.ARRAY_BUFFER,E,a.STATIC_DRAW);let k=a.createVertexArray();a.bindVertexArray(k),a.bindBuffer(a.ARRAY_BUFFER,w);let A=a.getAttribLocation(y,`aCorner`);a.enableVertexAttribArray(A),a.vertexAttribPointer(A,2,a.FLOAT,!1,0,0),a.bindBuffer(a.ARRAY_BUFFER,D),A=a.getAttribLocation(y,`aSeed`),a.enableVertexAttribArray(A),a.vertexAttribPointer(A,4,a.FLOAT,!1,0,0),a.vertexAttribDivisor(A,1),a.bindBuffer(a.ARRAY_BUFFER,O),A=a.getAttribLocation(y,`aVar`),a.enableVertexAttribArray(A),a.vertexAttribPointer(A,4,a.FLOAT,!1,0,0),a.vertexAttribDivisor(A,1);let j=a.createVertexArray();a.bindVertexArray(j),a.bindBuffer(a.ARRAY_BUFFER,w),A=a.getAttribLocation(b,`aCorner`),a.enableVertexAttribArray(A),a.vertexAttribPointer(A,2,a.FLOAT,!1,0,0),a.bindVertexArray(null);let M=a.getExtension(`EXT_color_buffer_float`),N=M?a.RGBA16F:a.RGBA8,P=M?a.HALF_FLOAT:a.UNSIGNED_BYTE,F=[],I=(e,t)=>{let n=a.createTexture();a.bindTexture(a.TEXTURE_2D,n),a.texImage2D(a.TEXTURE_2D,0,N,e,t,0,a.RGBA,P,null),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MIN_FILTER,a.LINEAR),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MAG_FILTER,a.LINEAR),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_S,a.CLAMP_TO_EDGE),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_T,a.CLAMP_TO_EDGE);let r=a.createFramebuffer();a.bindFramebuffer(a.FRAMEBUFFER,r),a.framebufferTexture2D(a.FRAMEBUFFER,a.COLOR_ATTACHMENT0,a.TEXTURE_2D,n,0),a.bindFramebuffer(a.FRAMEBUFFER,null);let i={fb:r,tex:n};return F.push(i),i},L=I(v,v),R=Math.max(1,v>>2),z=I(R,R),B=I(R,R),V={time:a.getUniformLocation(y,`uTime`),r:a.getUniformLocation(y,`uR`),len:a.getUniformLocation(y,`uLen`),width:a.getUniformLocation(y,`uWidth`),aspect:a.getUniformLocation(y,`uAspect`),minWidth:a.getUniformLocation(y,`uMinWidth`),tint:a.getUniformLocation(y,`uTint`)},H={scale:a.getUniformLocation(b,`uScale`),aspect:a.getUniformLocation(b,`uAspect`),intensity:a.getUniformLocation(b,`uIntensity`),pow:a.getUniformLocation(b,`uPow`),color:a.getUniformLocation(b,`uColor`)},U=a.getUniformLocation(S,`uDir`),W={scene:a.getUniformLocation(C,`uScene`),bloom:a.getUniformLocation(C,`uBloom`),mix:a.getUniformLocation(C,`uBloomMix`),expo:a.getUniformLocation(C,`uExpo`)},G=e=>{a.enable(a.BLEND),a.blendFunc(a.SRC_ALPHA,a.ONE),a.bindFramebuffer(a.FRAMEBUFFER,L.fb),a.viewport(0,0,v,v),a.clearColor(0,0,0,0),a.clear(a.COLOR_BUFFER_BIT),a.useProgram(b),a.bindVertexArray(j),a.uniform1f(H.aspect,1);for(let[e,t,n,r]of h)a.uniform1f(H.scale,e),a.uniform1f(H.intensity,t),a.uniform1f(H.pow,n),a.uniform3fv(H.color,r),a.drawArrays(a.TRIANGLES,0,6);a.useProgram(y),a.bindVertexArray(k),a.uniform1f(V.time,e),a.uniform1f(V.r,.62),a.uniform1f(V.len,.042),a.uniform1f(V.width,.0092),a.uniform1f(V.aspect,1),a.uniform1f(V.minWidth,1.15/v),a.uniform3fv(V.tint,n),a.drawArraysInstanced(a.TRIANGLES,0,6,t),a.disable(a.BLEND),a.bindVertexArray(j),a.bindFramebuffer(a.FRAMEBUFFER,z.fb),a.viewport(0,0,R,R),a.useProgram(x),a.activeTexture(a.TEXTURE0),a.bindTexture(a.TEXTURE_2D,L.tex),a.drawArrays(a.TRIANGLES,0,6),a.useProgram(S);for(let e=0;e<2;e++)a.bindFramebuffer(a.FRAMEBUFFER,B.fb),a.bindTexture(a.TEXTURE_2D,z.tex),a.uniform2f(U,1/R,0),a.drawArrays(a.TRIANGLES,0,6),a.bindFramebuffer(a.FRAMEBUFFER,z.fb),a.bindTexture(a.TEXTURE_2D,B.tex),a.uniform2f(U,0,1/R),a.drawArrays(a.TRIANGLES,0,6);a.bindFramebuffer(a.FRAMEBUFFER,null),a.viewport(0,0,v,v),a.useProgram(C),a.activeTexture(a.TEXTURE0),a.bindTexture(a.TEXTURE_2D,L.tex),a.uniform1i(W.scene,0),a.activeTexture(a.TEXTURE1),a.bindTexture(a.TEXTURE_2D,z.tex),a.uniform1i(W.bloom,1),a.uniform1f(W.mix,1.05),a.uniform1f(W.expo,.95),a.drawArrays(a.TRIANGLES,0,6)},K=0,q=!0,J=new IntersectionObserver(([e])=>{q=e.isIntersecting});J.observe(r);let Y=()=>q&&document.visibilityState===`visible`,X=e=>{e.preventDefault(),cancelAnimationFrame(K)};if(r.addEventListener(`webglcontextlost`,X),o)G(2.5);else{let e=performance.now(),t=n=>{K=requestAnimationFrame(t),Y()&&G((n-e)*.001)};K=requestAnimationFrame(t)}return()=>{cancelAnimationFrame(K),J.disconnect(),r.removeEventListener(`webglcontextlost`,X);for(let e of F)a.deleteFramebuffer(e.fb),a.deleteTexture(e.tex);a.deleteBuffer(w),a.deleteBuffer(D),a.deleteBuffer(O),a.deleteVertexArray(k),a.deleteVertexArray(j);for(let e of[y,b,x,S,C])a.deleteProgram(e)}},[e,t,n]),(0,o.jsx)(`canvas`,{ref:i,"aria-hidden":!0,className:r,style:{width:e,height:e,display:`block`}})}function y(){let[e,t]=(0,a.useState)(1);return(0,a.useEffect)(()=>{let e=setInterval(()=>t(e=>e%3+1),450);return()=>clearInterval(e)},[]),(0,o.jsx)(`span`,{className:`inline-block w-6 text-left`,children:`.`.repeat(e)})}function b(){return(0,o.jsx)(`main`,{className:`zone-dark min-h-screen bg-[#0a0a0b] px-6 py-16 text-fog`,children:(0,o.jsxs)(`div`,{className:`mx-auto flex max-w-5xl flex-col gap-14`,children:[(0,o.jsxs)(`header`,{children:[(0,o.jsx)(`p`,{className:`font-mono text-xs uppercase tracking-widest text-faint`,children:`WebGL2 · instanced streak quads · additive · bloom`}),(0,o.jsx)(`h1`,{className:`mt-3 text-4xl [font-family:var(--font-display)]`,children:`Glowing particle burst`}),(0,o.jsx)(`p`,{className:`mt-3 max-w-[62ch] leading-relaxed text-mute`,children:`A continuous radial emitter: grains fly outward from a blown-out core, each stretched along the screen projection of its own direction, so the field reads as a 3D volume rather than a flat starburst. Rebuilt in raw WebGL2 from the effect Jakub Wuzik posted.`})]}),(0,o.jsx)(`section`,{className:`relative overflow-hidden rounded-3xl border border-white/10 bg-[#101012] p-4`,children:(0,o.jsxs)(`div`,{className:`flex min-h-[420px] items-center gap-2`,children:[(0,o.jsx)(v,{size:340}),(0,o.jsxs)(`p`,{className:`-ml-6 text-4xl font-light tracking-tight text-white/85`,children:[`Calculating`,(0,o.jsx)(y,{})]})]})}),(0,o.jsxs)(`section`,{children:[(0,o.jsx)(`p`,{className:`font-mono text-xs uppercase tracking-widest text-faint`,children:`Scales down`}),(0,o.jsx)(`div`,{className:`mt-6 flex flex-wrap items-center gap-10`,children:[240,140,84,48].map(e=>(0,o.jsxs)(`div`,{className:`flex flex-col items-center gap-3`,children:[(0,o.jsx)(v,{size:e,count:e>100?1800:900}),(0,o.jsxs)(`span`,{className:`font-mono text-xs text-faint`,children:[e,`px`]})]},e))})]}),(0,o.jsxs)(`section`,{children:[(0,o.jsx)(`p`,{className:`font-mono text-xs uppercase tracking-widest text-faint`,children:`Inline, as a chip`}),(0,o.jsxs)(`div`,{className:`mt-6 flex flex-wrap items-center gap-4`,children:[(0,o.jsxs)(`span`,{className:`flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] py-1.5 pl-1 pr-4`,children:[(0,o.jsx)(v,{size:34,count:700}),(0,o.jsxs)(`span`,{className:`font-mono text-sm text-white/70`,children:[`routing 10 requests`,(0,o.jsx)(y,{})]})]}),(0,o.jsxs)(`span`,{className:`flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] py-1.5 pl-1 pr-4`,children:[(0,o.jsx)(v,{size:34,count:700,tint:[.83,.96,.45]}),(0,o.jsxs)(`span`,{className:`font-mono text-sm text-white/70`,children:[`brand tint`,(0,o.jsx)(y,{})]})]})]})]})]})})}(0,i.createRoot)(document.getElementById(`root`)).render((0,o.jsx)(a.StrictMode,{children:(0,o.jsx)(b,{})}));