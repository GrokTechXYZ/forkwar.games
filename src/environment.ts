import * as THREE from 'three';

export function makeEnvironment(scene: THREE.Scene) {
  const root = new THREE.Group(); scene.add(root);
  const stone = new THREE.MeshStandardMaterial({ color: 0x353e37, metalness: .3, roughness: .78 });
  const edge = new THREE.MeshStandardMaterial({ color: 0x636950, metalness: .72, roughness: .35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x17231f, metalness: .48, roughness: .6 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xbba073, metalness: .85, roughness: .3 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffd8a0, emissive: 0xffb957, emissiveIntensity: 4, roughness: .3 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x9fdfce, emissive: 0x77cdb0, emissiveIntensity: 2.5 });
  stone.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vStonePosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nvStonePosition=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vStonePosition;\nfloat hashStone(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}')
    .replace('#include <color_fragment>','#include <color_fragment>\nfloat grain=hashStone(floor(vStonePosition*250.));float vein=sin(vStonePosition.x*19.+sin(vStonePosition.z*11.)*4.);diffuseColor.rgb*=.84+grain*.2+vein*.035;');
  };
  const add = (geo:THREE.BufferGeometry, mat:THREE.Material, x:number,y:number,z:number, parent:THREE.Object3D=root) => {
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
  };
  const box = (w:number,h:number,d:number,mat:THREE.Material,x:number,y:number,z:number,parent:THREE.Object3D=root) => add(new THREE.BoxGeometry(w,h,d),mat,x,y,z,parent);
  const cylinder = (rt:number,rb:number,h:number,mat:THREE.Material,x:number,y:number,z:number,n=8) => add(new THREE.CylinderGeometry(rt,rb,h,n),mat,x,y,z);
  const ring = (radius:number,tube:number,mat:THREE.Material,x:number,y:number,z:number) => {const m=add(new THREE.TorusGeometry(radius,tube,6,96),mat,x,y,z);m.rotation.x=-Math.PI/2;return m;};

  // An original, self-contained teaser set. It exposes no map or gameplay data.
  cylinder(12.5,10.9,1.1,dark,0,-.85,0,8).rotation.y=Math.PI/8;
  cylinder(12.55,12.55,.13,edge,0,-.26,0,8).rotation.y=Math.PI/8;
  cylinder(12.4,12.4,.2,stone,0,-.1,0,8).rotation.y=Math.PI/8;
  cylinder(10.9,7,3.6,dark,0,-3,0,8).rotation.y=Math.PI/8;

  // Broad staggered slabs, weathered edges and inset seams.
  const slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),stone,126);
  const dummy = new THREE.Object3D(); let count=0;
  for(let z=-9;z<=9;z+=1.8) for(let x=-10;x<=10;x+=2.4){
    const px=x+((Math.round(z*10)%36)?1.2:0); if(Math.hypot(px,z)>10.6)continue;
    dummy.position.set(px,.015,z); dummy.scale.set(2.34,.05,1.73);dummy.rotation.set(0,0,0);dummy.updateMatrix();slabs.setMatrixAt(count++,dummy.matrix);
  }
  slabs.count=count;slabs.receiveShadow=true;root.add(slabs);
  const shardGeo=new THREE.DodecahedronGeometry(1,0);
  for(let i=0;i<36;i++){
    const a=i*2.399,r=10.2+Math.sin(i*13)*.9;
    const m=add(shardGeo,dark,Math.cos(a)*r,-1.6-(i%4)*.4,Math.sin(a)*r);
    m.scale.set(.9+(i%3)*.5,1.6+(i%5)*.42,.8+(i%4)*.3);m.rotation.set(i*.7,i*1.2,i*.3);
  }
  for(const r of [3.1,3.2,8.9,9])ring(r,.018,gold,0,.063,0);
  const sigil=new THREE.Group();root.add(sigil);
  for(const s of [-1,1]){const line=box(.055,.012,2.1,gold,s*.44,.067,0);line.rotation.y=s*-.45;}
  box(.055,.012,1.9,gold,0,.067,1.8);
  for(let i=0;i<24;i++){
    const a=i*Math.PI/12,r=9.5;const m=box(.04,.018,i%3===0?.65:.25,gold,Math.sin(a)*r,.08,Math.cos(a)*r);m.rotation.y=a;
  }
  for(const s of [-1,1]){
    box(.15,.08,15,dark,s*8,.08,0);
    box(.035,.025,14.5,teal,s*8,.13,0);
    for(const z of [-7.5,7.5]){cylinder(.55,.7,.3,edge,s*8,.15,z);cylinder(.25,.35,.12,glow,s*8,.36,z);}
  }

  const spire=new THREE.Group();spire.position.set(0,0,-7);root.add(spire);
  const base=add(new THREE.CylinderGeometry(2,2.6,.55,8),dark,0,.2,0,spire);
  add(new THREE.CylinderGeometry(1.7,2.05,.16,8),gold,0,.52,0,spire);
  add(new THREE.CylinderGeometry(.65,1.25,4.8,6),dark,0,2.9,0,spire);
  for(const side of [-1,1]){
    const arm=box(.85,5.8,.85,edge,side*1.1,4.8,0,spire);arm.rotation.z=-side*.18;
    const inset=box(.06,5.9,.91,glow,side*1.1,4.8,.03,spire);inset.rotation.z=-side*.18;
    const cap=box(.95,.25,1,gold,side*1.62,7.7,0,spire);cap.rotation.z=-side*.18;
  }
  const crystal=add(new THREE.OctahedronGeometry(.8,0),glow,0,5.3,0,spire);crystal.scale.set(.6,1.8,.6);
  const halo=add(new THREE.TorusGeometry(1.65,.025,6,96),gold,0,5.3,0,spire);halo.rotation.x=.9;
  const halo2=add(new THREE.TorusGeometry(1.9,.015,6,96),glow,0,5.3,0,spire);halo2.rotation.x=1.6;halo2.rotation.y=.3;
  const coreLight=new THREE.PointLight(0xffbd70,70,16,2);coreLight.position.set(0,5,-7);scene.add(coreLight);
  const floorLight=new THREE.PointLight(0x76bda5,28,15,2);floorLight.position.set(4,3,3);scene.add(floorLight);

  for(let i=0;i<6;i++){
    const a=-Math.PI/2+(i-2.5)*.4,rad=11.1,x=Math.cos(a)*rad,z=Math.sin(a)*rad,h=2+(i%3)*.7;
    cylinder(.65,.95,.4,dark,x,.2,z);
    box(.55,h,.55,edge,x,h/2,z);
    box(.04,h*.8,.59,teal,x,h/2,z);
    box(.8,.16,.8,gold,x,h,z);
  }

  // Distant monoliths disappear into layered atmospheric haze.
  for(let i=0;i<18;i++){
    const a=i*2.399,r=21+(i%4)*7,x=Math.cos(a)*r,z=Math.sin(a)*r-10;
    const h=4+(i%6)*2.8;
    const m=add(new THREE.CylinderGeometry(1.6,3.1,h,5),dark,x,-6+h/2,z);m.rotation.y=i;
    if(i%3===0)box(.06,h*.6,.08,teal,x,-3+h/2,z+1.4);
  }

  const beamMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,uniforms:{color:{value:new THREE.Color(0xd0a46c)}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform vec3 color;void main(){float a=pow(sin(vUv.x*3.14159265),3.)*.025*(1.-vUv.y);gl_FragColor=vec4(color,a);}'});
  add(new THREE.CylinderGeometry(.1,2.3,19,32,1,true),beamMaterial,0,14.2,-7);

  const moteCount=420,positions=new Float32Array(moteCount*3),basePositions=new Float32Array(moteCount*3);
  for(let i=0;i<moteCount;i++){
    basePositions[i*3]=Math.sin(i*11.91)*19;
    basePositions[i*3+1]=((i*1.37)%11)-2;
    basePositions[i*3+2]=Math.cos(i*7.37)*16;
  }
  const moteGeometry=new THREE.BufferGeometry();moteGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const moteMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{pixelRatio:{value:Math.min(devicePixelRatio,1.5)}},vertexShader:'uniform float pixelRatio;varying float fade;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(65./-mv.z,1.,3.)*pixelRatio;fade=clamp(1.-(-mv.z)/65.,0.,1.);}',fragmentShader:'varying float fade;void main(){float a=pow(max(0.,1.-length(gl_PointCoord-.5)*2.),2.);gl_FragColor=vec4(.89,.75,.49,a*fade*.6);}'});
  const motes=new THREE.Points(moteGeometry,moteMaterial);motes.frustumCulled=false;root.add(motes);
  const shockMaterial=new THREE.MeshBasicMaterial({color:0xffbe68,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
  const shock=add(new THREE.RingGeometry(.96,1,128),shockMaterial,0,.12,0);shock.rotation.x=-Math.PI/2;

  // Moving wisps interrupt the view, keeping the scene a glimpse rather than a reveal.
  const fogMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
    varying vec2 vUv;uniform float time;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    void main(){vec2 p=vUv*vec2(6.,3.)+vec2(time*.035,-time*.015);float n=noise(p)*.5+noise(p*2.03)*.25+noise(p*4.1)*.125;float edge=pow(sin(vUv.x*3.14159)*sin(vUv.y*3.14159),1.4);gl_FragColor=vec4(.24,.31,.27,edge*smoothstep(.22,.7,n)*.14);}
  `});
  const fogPlanes:THREE.Mesh[]=[];
  for(let i=0;i<7;i++){
    const m=add(new THREE.PlaneGeometry(29,8),fogMaterial,Math.sin(i*3)*7,.5+(i%3)*1.2,-10+i*4);m.rotation.x=-.2;fogPlanes.push(m);
  }

  return {update(t:number,impact:number,focus:THREE.Vector3){
    fogMaterial.uniforms.time.value=t;
    fogPlanes.forEach((m,i)=>{m.position.x=Math.sin(t*.045+i*3)*5;});
    crystal.rotation.y=t*.24;crystal.position.y=5.3+Math.sin(t*.8)*.15;
    halo.rotation.z=t*.09;halo2.rotation.z=-t*.13;
    coreLight.intensity=65+Math.sin(t*.7)*8;
    for(let i=0;i<moteCount;i++){
      positions[i*3]=basePositions[i*3]+Math.sin(t*.12+i)*.5;
      positions[i*3+1]=((basePositions[i*3+1]+t*(.025+(i%4)*.009)+3)%12)-3;
      positions[i*3+2]=basePositions[i*3+2]+Math.cos(t*.1+i)*.4;
    }
    moteGeometry.attributes.position.needsUpdate=true;
    shock.position.set(focus.x,.12,focus.z);shock.scale.setScalar(.1+impact*5);
    shockMaterial.opacity=impact>0?(1-impact)*.35:0;
  },dispose(){
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
    root.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());scene.remove(root,coreLight,floorLight);
  }};
}
