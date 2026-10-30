import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export type RigPose = {
 phase:'idle'|'run'|'windup'|'attack'|'recover'|'hit'|'block'|'down'|'victory';
 progress:number; time:number; ability?:string; seed:number; reduced:boolean;
};
export interface CombatRig {
 root:THREE.Group; height:number; muzzle:THREE.Object3D; drone?:THREE.Object3D;
 pose:(state:RigPose)=>void; dispose:()=>void;
}

/** Original runtime-built models: every visible surface has volume and takes scene light. */
export function createCombatRig(kind:string,side:'player'|'enemy'):CombatRig {
 const root=new THREE.Group();root.name=`combat-rig-${kind}`;
 const motion=new THREE.Group();root.add(motion);
 const geometries=new Set<THREE.BufferGeometry>();
 const materials=new Set<THREE.Material>();
 const material=(color:THREE.ColorRepresentation,metalness=.18,roughness=.5,emissive?:THREE.ColorRepresentation)=>{
  const m=new THREE.MeshStandardMaterial({color,metalness,roughness,emissive:emissive??0,emissiveIntensity:emissive?1.4:0});materials.add(m);return m;
 };
 const armor=material(kind==='scout'?0x387a74:kind==='striker'?0xb57932:kind==='guardian'?0x526289:0x535e66,.55,.3);
 const armorLight=material(kind==='scout'?0x70a59a:kind==='striker'?0xe1ad5b:kind==='guardian'?0x91a5c9:0x8e979b,.48,.34);
 const edge=material(kind==='striker'?0xffd093:0xb9c9c8,.75,.28);
 const dark=material(0x16292f,.32,.63);
 const cloth=material(kind==='scout'?0x244c4a:kind==='striker'?0x513f32:kind==='guardian'?0x2b344d:0x29323d,.02,.89);
 const skin=material(kind==='striker'?0x915b3f:kind==='guardian'?0xc99376:0xddab8b,.01,.82);
 const skinLight=material(kind==='striker'?0xb57d58:0xe7b79a,.01,.8);
 const hair=material(kind==='scout'?0x6b3024:kind==='striker'?0x241e21:0xb9c3c4,.04,.82);
 const eye=material(0x0c1619,.18,.27);
 const white=material(0xe6e7de,.04,.75);
 const lightColor=kind==='striker'?0xff7d26:kind==='guardian'?0x93b9ff:kind==='scout'?0x55ffdb:side==='enemy'?0xffb85b:0x7bf6d1;
 const glow=material(lightColor,.2,.22,lightColor);
 const softGlow=material(kind==='guardian'?0x688ed6:lightColor,.38,.29,lightColor);softGlow.emissiveIntensity=.45;
 const mesh=(parent:THREE.Object3D,geometry:THREE.BufferGeometry,mat:THREE.Material,x=0,y=0,z=0)=>{
  geometries.add(geometry);const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
 };
 const box=(p:THREE.Object3D,w:number,h:number,d:number,mat:THREE.Material,x=0,y=0,z=0,r=.05)=>mesh(p,new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)),mat,x,y,z);
 const sphere=(p:THREE.Object3D,r:number,mat:THREE.Material,x=0,y=0,z=0,sx=1,sy=1,sz=1)=>{const m=mesh(p,new THREE.SphereGeometry(r,12,10),mat,x,y,z);m.scale.set(sx,sy,sz);return m;};
 const cylinder=(p:THREE.Object3D,rt:number,rb:number,h:number,mat:THREE.Material,x=0,y=0,z=0,n=12)=>mesh(p,new THREE.CylinderGeometry(rt,rb,h,n),mat,x,y,z);
 const torus=(p:THREE.Object3D,r:number,tube:number,mat:THREE.Material,x=0,y=0,z=0)=>mesh(p,new THREE.TorusGeometry(r,tube,6,18),mat,x,y,z);
 const joint=(parent:THREE.Object3D,name:string,x:number,y:number,z=0)=>{const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;};
 const marker=(p:THREE.Object3D,x:number,y:number,z:number)=>{const m=new THREE.Object3D();m.position.set(x,y,z);p.add(m);return m;};
 let muzzle:THREE.Object3D=marker(motion,0,1.6,.5),drone:THREE.Group|undefined;
 const isHero=['scout','striker','guardian'].includes(kind);

 // One surface draw per joint keeps a reinforced battlefield affordable. Vertex
 // channels retain each piece's color, roughness and metalness after batching.
 const surfaceMaterial=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1,metalness:1});
 surfaceMaterial.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 surface; varying vec2 vSurface;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSurface = surface;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vSurface;').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor *= vSurface.x;').replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor *= vSurface.y;');
 };
 surfaceMaterial.customProgramCacheKey=()=> 'forkwar-rig-surface-v1';materials.add(surfaceMaterial);
 // Join static detail within each pivot, preserving all animated joints.
 function compact(node:THREE.Object3D){
  for(const child of [...node.children])if(child instanceof THREE.Group)compact(child);
  const batches=new Map<THREE.Material,THREE.Mesh[]>();
  for(const child of [...node.children])if(child instanceof THREE.Mesh&&!Array.isArray(child.material)){
   const original=child.material as THREE.MeshStandardMaterial;
   const batch=original.emissive?.getHex()===0?surfaceMaterial:original;
   const list=batches.get(batch)??[];list.push(child);batches.set(batch,list);
  }
  for(const [mat,list] of batches){if(list.length<2&&mat!==surfaceMaterial)continue;
   const parts=list.map(item=>{item.updateMatrix();const g=item.geometry.clone();g.applyMatrix4(item.matrix);
    if(mat===surfaceMaterial){const original=item.material as THREE.MeshStandardMaterial,count=g.attributes.position.count;
     const colors=new Float32Array(count*3),surface=new Float32Array(count*2);
     for(let i=0;i<count;i++){colors.set([original.color.r,original.color.g,original.color.b],i*3);surface.set([original.roughness,original.metalness],i*2);}
     g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.setAttribute('surface',new THREE.BufferAttribute(surface,2));
    }
    return g;
   });
   const compatible=parts.map(g=>{if(g.index){const n=g.toNonIndexed();g.dispose();return n;}return g;});
   const combined=mergeGeometries(compatible,false);compatible.forEach(g=>g.dispose());
   if(combined){list.forEach(item=>node.remove(item));mesh(node,combined,mat);}
  }
 }
 const dispose=()=>{geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.clear();};

 if(!isHero){
  const hover=['leech','drone','phantom'].includes(kind),heavy=['warden','sentinel','validator'].includes(kind);
  const chassis=joint(motion,'chassis',0,hover?1.35:1.25);
  const legs:THREE.Group[]=[];
  if(hover){
   sphere(chassis,.49,armor,0,0,0,1.2,.78,1);
   const carapace=mesh(chassis,new THREE.DodecahedronGeometry(.5,0),armorLight,0,.15,-.08);carapace.scale.set(1.2,.7,1.1);
   const ring=torus(chassis,.54,.052,edge);ring.rotation.x=Math.PI/2;
   const lens=cylinder(chassis,.22,.18,.17,dark,0,.08,.44);lens.rotation.x=Math.PI/2;
   const pupil=cylinder(chassis,.145,.145,.2,glow,0,.08,.47);pupil.rotation.x=Math.PI/2;
   for(const s of [-1,1]){box(chassis,.48,.12,.35,armor,s*.58,.02,-.06);const fan=torus(chassis,.22,.045,dark,s*.67,.025,-.07);fan.rotation.x=Math.PI/2;cylinder(chassis,.16,.13,.09,softGlow,s*.67,.02,-.07);}
   for(let i=0;i<3;i++){const tendril=joint(chassis,`tendril-${i}`,(i-1)*.25,-.25,-.05);cylinder(tendril,.045,.025,.48,edge,0,-.22,0);sphere(tendril,.055,glow,0,-.47,0);legs.push(tendril);}
   muzzle=marker(chassis,0,.08,.62);
  } else {
   const size=heavy?1.25:1;
   box(chassis,.78*size,.75*size,.55,armor,0,.23,0,.14);
   box(chassis,.62*size,.4,.16,dark,0,.27,.3);
   box(chassis,.42,.13,.05,glow,0,.36,.4,.02);
   box(chassis,.36,.12,.1,edge,0,-.08,.35);
   const head=joint(chassis,'sensor-head',0,.82,0);
   box(head,.56,.42,.47,armorLight,0,0,0,.11);box(head,.44,.14,.07,dark,0,.025,.25);box(head,.3,.055,.035,glow,0,.025,.295,.01);
   cylinder(head,.024,.024,.37,edge,.23,.35,-.1);sphere(head,.055,glow,.23,.55,-.1);
   for(const s of [-1,1]){
    const hip=joint(motion,`leg-${s}`,s*.3,1.1);legs.push(hip);
    sphere(hip,.17,dark);box(hip,.27,.42,.31,armor,0,-.21,0,.09);cylinder(hip,.15,.15,.32,edge,0,-.46,0).rotation.z=Math.PI/2;
    box(hip,.24,.42,.26,armorLight,0,-.7,0,.07);box(hip,.34,.19,.56,dark,0,-.96,.11,.06);
    const shoulder=joint(chassis,`gun-arm-${s}`,s*(heavy?.65:.51),.42);box(shoulder,.38,.39,.42,armorLight,0,0,0,.1);box(shoulder,.24,.48,.28,dark,0,-.35,0);
    const gun=cylinder(shoulder,.13,.16,.7,armor,0,-.48,.33);gun.rotation.x=Math.PI/2;
    const bore=cylinder(shoulder,.085,.085,.12,glow,0,-.48,.72);bore.rotation.x=Math.PI/2;
    if(s===1)muzzle=marker(shoulder,0,-.48,.8);
   }
   if(heavy){box(chassis,.88,.2,.8,armorLight,0,.69,0);for(const s of [-1,1]){const stack=cylinder(chassis,.12,.14,.7,dark,s*.43,.55,-.45);stack.rotation.x=-.2;torus(chassis,.15,.04,edge,s*.43,.9,-.5).rotation.x=Math.PI/2;}box(chassis,.43,.46,.15,softGlow,0,.25,.4);}
   if(kind==='cannon'){const barrel=cylinder(chassis,.22,.32,1.2,armor,0,.5,.75);barrel.rotation.x=Math.PI/2;torus(chassis,.2,.05,edge,0,.5,1.35);muzzle=marker(chassis,0,.5,1.4);}
  }
  compact(root);
  const baseY=chassis.position.y;
  return {root,height:hover?2.1:heavy?2.8:2.65,muzzle,dispose,pose(state){
   const p=state.reduced&&state.phase==='down'?1:THREE.MathUtils.clamp(state.progress,0,1),t=state.reduced||state.phase==='down'?0:state.time;
   const run=state.phase==='run'&&!state.reduced,step=Math.sin(t*17+state.seed);
   motion.position.set(0,run?Math.abs(step)*.07:0,0);motion.rotation.set(0,0,0);
   chassis.position.y=baseY+(hover?Math.sin(t*2.8+state.seed)*.08:0);chassis.rotation.set(0,0,hover?Math.sin(t*1.9)*.05:0);
   legs.forEach((leg,i)=>{leg.rotation.set(hover?Math.sin(t*3+i)*.13:run?step*(i%2?-1:1)*.56:0,0,0);});
   if(state.phase==='windup'){chassis.rotation.x=-.12*Math.sin(p*Math.PI/2);chassis.position.z=-.12*p;}
   else chassis.position.z=0;
   if(state.phase==='attack'){chassis.rotation.x=.18*Math.sin(p*Math.PI);chassis.position.z=-.15*Math.sin(p*Math.PI);}
   if(state.phase==='hit'){motion.rotation.x=-.19*Math.sin(p*Math.PI);motion.position.z=-.15*Math.sin(p*Math.PI);}
   if(state.phase==='down'){
    motion.rotation.z=-1.35*p;
    // Lift the rotating chassis by its side extent so its mass settles on the
    // floor instead of disappearing through it as the foot pivot rolls over.
    motion.position.y=hover?.07+.75*p**4:.035+(heavy?.64:.49)*p;
   }
   glow.emissiveIntensity=state.phase==='attack'?2.5:1.25;
  }};
 }

 const wide=kind==='guardian'?1.17:kind==='striker'?1.04:1;
 const pelvis=joint(motion,'pelvis',0,1.22);
 box(pelvis,.55*wide,.28,.38,dark,0,.02,0,.1);
 box(pelvis,.63*wide,.16,.43,cloth,0,.1,0,.04);
 box(pelvis,.15,.14,.08,edge,0,.1,.24,.025);
 const torso=joint(motion,'spine',0,1.35);
 const chest=box(torso,.72*wide,.72,.43,armor,0,.43,0,.16);chest.rotation.x=-.04;
 box(torso,.67*wide,.25,.52,armorLight,0,.68,.015,.085);
 box(torso,.4,.37,.1,armorLight,0,.4,.24,.06);
 box(torso,.35,.085,.07,edge,0,.21,.28,.02);
 box(torso,.13,.23,.065,softGlow,kind==='striker'?.15:-.15,.52,.31,.025);
 for(const s of [-1,1]){
  box(torso,.11,.47,.09,cloth,s*.25,.45,.27,.02).rotation.z=s*-.08;
  box(torso,.12,.14,.08,edge,s*.26,.67,.29,.02);
  for(let i=0;i<2;i++)box(pelvis,.16,.21,.13,armorLight,s*(.19+i*.06),-.01,.24,.035);
 }
 // Backpack reactor, vents and collar provide depth from the enemy-side camera angle.
 box(torso,.55,.58,.24,dark,0,.46,-.33,.1);
 box(torso,.34,.38,.12,armorLight,0,.45,-.49,.06);
 for(let i=0;i<3;i++)box(torso,.23,.035,.04,edge,0,.35+i*.09,-.56,.01);
 box(torso,.49,.12,.37,dark,0,.83,0,.05);
 const neck=joint(torso,'neck',0,.93,.025);cylinder(neck,.13,.15,.2,skin,0,0,0);
 const head=joint(neck,'head',0,.18,.015);
 const face=box(head,.43,.51,.4,skin,0,0,.01,.14);face.rotation.x=.025;
 sphere(head,.07,skinLight,-.235,-.005,0,.65,1,.68);sphere(head,.07,skinLight,.235,-.005,0,.65,1,.68);
 // A real projecting nose, inset eyes, brows and cheekbones keep the face dimensional.
 sphere(head,.07,skinLight,0,-.015,.229,.65,1.05,1.2);
 for(const s of [-1,1]){
  sphere(head,.054,white,s*.108,.065,.192,1,.58,.46);
  sphere(head,.026,eye,s*.105,.063,.22,.62,1,.5);
  const brow=box(head,.11,.025,.027,hair,s*.107,.128,.211,.008);brow.rotation.z=s*-.09;
  sphere(head,.075,skinLight,s*.14,-.066,.15,.8,.5,.6);
 }
 box(head,.13,.017,.024,kind==='striker'?hair:skinLight,0,-.145,.207,.007);
 if(kind==='scout'){
  sphere(head,.255,hair,0,.16,-.025,1.02,.64,1.01);
  box(head,.48,.23,.29,hair,0,-.05,-.17,.11);
  for(const s of [-1,1])box(head,.11,.39,.25,hair,s*.205,.015,-.035,.045).rotation.z=s*.08;
  for(let i=0;i<4;i++){const lock=box(head,.16,.14,.09,hair,-.135+i*.082,.205,.16,.04);lock.rotation.z=-.22;}
  box(head,.07,.13,.06,edge,-.24,.025,.01,.025);sphere(head,.024,glow,-.28,.05,.04);
 } else if(kind==='striker'){
  for(let i=0;i<16;i++){const a=i*Math.PI*2/16;sphere(head,.1,hair,Math.cos(a)*.205,.2+Math.sin(i*2)*.025,Math.sin(a)*.17,1,.85,1);}
  for(let i=0;i<8;i++){const a=i*Math.PI*2/8;sphere(head,.09,hair,Math.cos(a)*.14,.31,Math.sin(a)*.11);}
  box(head,.46,.065,.13,cloth,0,.21,.14,.02);box(head,.18,.07,.045,armorLight,0,.21,.23,.02);
  torus(head,.052,.012,edge,-.245,-.055,.015).rotation.y=Math.PI/2;
 } else {
  sphere(head,.245,hair,0,.18,-.045,1,.55,1);
  for(const s of [-1,1])box(head,.085,.29,.23,hair,s*.208,.04,-.04,.035);
  sphere(head,.165,hair,0,-.195,.12,1.15,.75,.7);
  box(head,.28,.05,.07,hair,0,-.11,.22,.02);
  for(let i=0;i<3;i++)box(head,.06,.16,.06,hair,(i-1)*.075,-.23,.21,.02).rotation.x=.15;
 }

 const hips:THREE.Group[]=[],knees:THREE.Group[]=[],ankles:THREE.Group[]=[];
 for(const s of [-1,1]){
  const hip=joint(motion,`${s===-1?'left':'right'}-hip`,s*.205*wide,1.19);hips.push(hip);
  box(hip,.28*wide,.46,.32,cloth,0,-.22,0,.1);
  box(hip,.28*wide,.3,.105,armor,0,-.22,.17,.065);
  box(hip,.07,.24,.12,edge,s*.14,-.22,.13,.02);
  const knee=joint(hip,`${s===-1?'left':'right'}-knee`,0,-.47);knees.push(knee);
  sphere(knee,.145,dark);box(knee,.26,.2,.17,armorLight,0,0,.13,.065);
  box(knee,.235,.37,.26,cloth,0,-.22,0,.07);
  box(knee,.25,.28,.1,armor,0,-.22,.145,.05);
  const ankle=joint(knee,`${s===-1?'left':'right'}-ankle`,0,-.43);ankles.push(ankle);
  box(ankle,.29,.23,.41,dark,0,-.15,.075,.065);
  box(ankle,.3,.13,.25,armorLight,0,-.13,.2,.04);
  box(ankle,.32,.065,.46,cloth,0,-.255,.09,.015);
  box(ankle,.2,.055,.07,edge,0,-.09,.33,.015);
 }
 const shoulders:THREE.Group[]=[],elbows:THREE.Group[]=[],hands:THREE.Group[]=[];
 for(const s of [-1,1]){
  const shoulder=joint(torso,`${s===-1?'left':'right'}-shoulder`,s*.45*wide,.73,0);shoulders.push(shoulder);
  sphere(shoulder,.2,dark);box(shoulder,.39*wide,.3,.43,armorLight,0,.005,0,.11);
  box(shoulder,.26,.08,.31,edge,0,.15,.015,.025);
  box(shoulder,.23,.34,.26,cloth,0,-.25,0,.085);
  box(shoulder,.25,.24,.09,armor,0,-.25,.14,.06);
  const elbow=joint(shoulder,`${s===-1?'left':'right'}-elbow`,0,-.42);elbows.push(elbow);
  sphere(elbow,.13,dark);box(elbow,.24,.3,.28,armor,0,-.2,0,.075);
  box(elbow,.25,.065,.29,edge,0,-.28,0,.02);
  const hand=joint(elbow,`${s===-1?'left':'right'}-hand`,0,-.4);hands.push(hand);
  box(hand,.18,.18,.16,dark,0,-.035,0,.045);
  for(let f=0;f<3;f++)box(hand,.045,.11,.075,kind==='striker'?skin:armorLight,(f-1)*.048,-.13,.035,.02);
  box(hand,.07,.12,.07,kind==='striker'?skin:armorLight,s*.11,-.035,.05,.025).rotation.z=-s*.4;
 }
 let cape:THREE.Group|undefined,shieldPivot:THREE.Group|undefined;
 if(kind==='guardian'){
  cape=joint(torso,'mantle',0,.72,-.3);
  const shape=new THREE.Shape();shape.moveTo(-.37,0);shape.lineTo(.37,0);shape.lineTo(.47,-1.25);shape.quadraticCurveTo(0,-1.43,-.47,-1.25);shape.closePath();
  const mantle=mesh(cape,new THREE.ExtrudeGeometry(shape,{depth:.045,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:1,steps:1}),cloth,0,0,-.05);mantle.rotation.x=.1;
  for(const s of [-1,1])sphere(torso,.075,edge,s*.28,.73,.27);
  const shield=joint(elbows[0],'guardian-shield',-.12,-.22,.25);
  shieldPivot=shield;
  const outline=new THREE.Shape();outline.moveTo(-.47,.52);outline.lineTo(0,.7);outline.lineTo(.47,.52);outline.lineTo(.46,-.25);outline.lineTo(0,-.65);outline.lineTo(-.46,-.25);outline.closePath();
  mesh(shield,new THREE.ExtrudeGeometry(outline,{depth:.14,bevelEnabled:true,bevelThickness:.055,bevelSize:.055,bevelSegments:2,steps:1}),edge,0,0,-.06);
  const faceShield=mesh(shield,new THREE.ExtrudeGeometry(outline,{depth:.05,bevelEnabled:true,bevelThickness:.02,bevelSize:.02,bevelSegments:1}),armor,0,0,.13);faceShield.scale.set(.86,.87,1);
  const inlay=mesh(shield,new THREE.ExtrudeGeometry(outline,{depth:.025,bevelEnabled:false}),softGlow,0,.02,.21);inlay.scale.set(.57,.66,1);
  const core=mesh(shield,new THREE.OctahedronGeometry(.22),glow,0,.02,.26);core.scale.set(.65,1,.35);
  muzzle=marker(shield,0,0,.4);
  box(hands[1],.16,.43,.15,edge,0,-.12,.01,.03);box(hands[1],.39,.14,.13,armorLight,0,-.35,.01,.03);
 } else if(kind==='striker'){
  const gauntlet=joint(elbows[1],'thermal-gauntlet',0,-.26,0);
  box(gauntlet,.4,.47,.43,armorLight,0,-.045,.015,.12);
  box(gauntlet,.45,.19,.48,armor,0,.15,0,.05);
  cylinder(gauntlet,.22,.22,.12,dark,0,-.29,0);
  cylinder(gauntlet,.155,.155,.14,glow,0,-.31,0);
  for(let i=0;i<4;i++){const a=i*Math.PI/2;box(gauntlet,.075,.28,.07,softGlow,Math.cos(a)*.21,-.045,Math.sin(a)*.22,.02);}
  const core=cylinder(gauntlet,.1,.1,.08,glow,.24,.04,0);core.rotation.z=Math.PI/2;
  muzzle=marker(gauntlet,0,-.43,0);
  for(const s of [-1,1]){const tank=cylinder(torso,.105,.105,.48,armorLight,s*.19,.45,-.55);torus(torso,.11,.025,edge,s*.19,.2,-.55).rotation.x=Math.PI/2;tank.rotation.z=s*.09;}
 } else {
  const rifle=joint(hands[1],'pulse-carbine',0,-.03,.015);
  box(rifle,.18,.55,.22,dark,0,-.23,0,.035);
  box(rifle,.21,.28,.24,armorLight,0,-.2,0,.04);
  cylinder(rifle,.062,.075,.43,edge,0,-.58,0);cylinder(rifle,.085,.085,.1,dark,0,-.79,0);
  cylinder(rifle,.042,.042,.11,glow,0,-.805,0);
  box(rifle,.09,.18,.1,dark,0,-.2,-.18,.02);box(rifle,.07,.21,.06,glow,.115,-.25,0,.015);
  box(rifle,.1,.18,.08,dark,0,.12,0,.02);muzzle=marker(rifle,0,-.87,0);
  drone=joint(motion,'survey-drone',-.68,2.35,-.3);
  sphere(drone,.17,armorLight,0,0,0,1.2,.65,1);
  const droneRing=torus(drone,.22,.026,edge);droneRing.rotation.x=Math.PI/2;
  sphere(drone,.065,glow,0,0,.15);
  for(const s of [-1,1]){box(drone,.25,.045,.07,armor,s*.25,.01,0,.015);const fan=torus(drone,.12,.018,dark,s*.33,0,0);fan.rotation.x=Math.PI/2;}
 }
 if(kind==='guardian'){motion.scale.setScalar(1.08);}else if(kind==='striker'){motion.scale.set(1.03,1.02,1.03);}
 compact(root);
 return {root,height:kind==='guardian'?3.2:3,muzzle,drone,dispose,pose(state){
  const p=state.reduced&&state.phase==='down'?1:THREE.MathUtils.clamp(state.progress,0,1),t=state.reduced||state.phase==='down'?0:state.time;
  const wave=Math.sin(t*2.7+state.seed),running=state.phase==='run'&&!state.reduced;
  const gait=t*17+state.seed,swing=Math.sin(gait),pulse=Math.sin(p*Math.PI),hit=Math.sin(Math.min(1,p*1.35)*Math.PI);
  motion.position.set(0,running?Math.abs(Math.sin(gait))* .075:wave*.012,0);motion.rotation.set(0,0,0);
  pelvis.rotation.set(0,running?swing*.07:0,0);torso.rotation.set(running?.13:0,running?-swing*.07:0,0);
  neck.rotation.set(0,0,0);head.rotation.set(0,0,0);
  shoulders.forEach((s,i)=>{s.rotation.set(running?swing*(i===0?1:-1)*.5:kind==='scout'?(i===1?-1.15:-.62):kind==='guardian'?(i===0?-.28:-.15):-.15,0,i===0?.09:-.09);});
  elbows.forEach((e,i)=>{e.rotation.set(running?-.35:kind==='scout'?(i===1?-.18:-.82):kind==='guardian'&&i===0?-.18:-.14,0,0);});
  hips.forEach((h,i)=>{const step=swing*(i===0?1:-1);h.rotation.set(running?step*.62:0,0,0);knees[i].rotation.x=running?Math.max(0,-step)*1.02:.045;ankles[i].rotation.x=running?-Math.max(0,step)*.3:0;});
  if(cape){cape.rotation.x=running?-.2-Math.abs(swing)*.15:.04+wave*.025;cape.rotation.z=running?swing*.05:0;}
  if(drone){drone.position.set(-.68,2.35+wave*.08,-.3);drone.rotation.set(0,Math.sin(t)*.14,Math.sin(t*2.1)*.08);}
  const charge=state.phase==='windup'?p:state.phase==='attack'?1-p:0;
  if(state.phase==='windup'||state.phase==='attack'||state.phase==='recover'){
   const strike=state.phase==='attack'?Math.sin(Math.min(1,p*2.2)*Math.PI/2):0;
   const recover=state.phase==='recover'?1-p:1;
   hips[0].rotation.x=-.12*recover;hips[1].rotation.x=.14*recover;knees[0].rotation.x=.16*recover;
   if(kind==='scout'){
    if(state.ability==='fx-signal'){
     shoulders[0].rotation.x=-1.65*(state.phase==='windup'?p:recover);elbows[0].rotation.x=-.5;
     torso.rotation.y=-.12*charge;head.rotation.y=-.12*charge;
     if(drone){drone.position.set(-.2,2.9+.3*charge,.4+.5*charge);drone.rotation.y=t*2;}
    } else {
     shoulders[1].rotation.x=-1.42+.14*pulse*(state.phase==='attack'?1:0);elbows[1].rotation.x=-.1;
     shoulders[0].rotation.x=-.8;elbows[0].rotation.x=-1.1;torso.rotation.x=state.phase==='attack'?-.065*pulse:.035*charge;
    }
   } else if(kind==='striker'){
    torso.rotation.y=state.phase==='windup'?-.4*p:state.phase==='attack'?-.4+.72*strike:.32*recover;
    shoulders[1].rotation.x=state.phase==='windup'?-.45*p:state.phase==='attack'?-.45-1.25*strike:-1.7*recover;
    shoulders[1].rotation.z=-.28*charge;elbows[1].rotation.x=state.phase==='windup'?-1.05*p:state.phase==='attack'?-1.05*(1-strike):0;
    shoulders[0].rotation.x=-.45;elbows[0].rotation.x=-.8;motion.position.z=state.phase==='attack'?.2*strike:0;
    if(state.ability==='fx-fire'){shoulders[1].rotation.y=state.phase==='attack'?-.35+.7*strike:-.35*charge;torso.rotation.x=-.07*charge;}
   } else {
    shoulders[0].rotation.x=state.phase==='windup'?-.35-.25*p:state.phase==='attack'?-.6-.45*strike:-1.05*recover;
    elbows[0].rotation.x=state.phase==='windup'?-.3*p:state.phase==='attack'?-.3+.3*strike:0;
    torso.rotation.y=state.phase==='windup'?.24*p:state.phase==='attack'?.24-.4*strike:-.16*recover;
    torso.rotation.x=state.phase==='attack'?.18*strike:0;motion.position.z=state.phase==='attack'?.22*strike:0;
    shoulders[1].rotation.x=-.5;elbows[1].rotation.x=-.55;
   }
  }
  if(state.phase==='hit'){
   torso.rotation.x=-.23*hit;torso.rotation.z=.09*hit;head.rotation.x=-.12*hit;
   motion.position.z=-.15*hit;knees[0].rotation.x=.25*hit;hips[0].rotation.x=-.12*hit;
   shoulders[1].rotation.z=-.15-.2*hit;elbows[1].rotation.x=-.35*hit;
  }
  if(state.phase==='block'){
   shoulders[0].rotation.x=-.85;elbows[0].rotation.x=-.2;torso.rotation.x=-.1*hit;hips[0].rotation.x=-.13;knees[0].rotation.x=.23;
  }
  if(state.phase==='down'){
   motion.rotation.x=-1.35*p;motion.rotation.z=.24*p;
   motion.position.y=.05+.19*p+(kind==='guardian'?.25:kind==='striker'?.22:.11)*p**4;
   hips[0].rotation.x=-.35*p;knees[0].rotation.x=.7*p;shoulders[0].rotation.z=.7*p;shoulders[1].rotation.z=-.65*p;head.rotation.x=.2*p;
  }
  if(state.phase==='victory'){
   shoulders[1].rotation.x=-.65;elbows[1].rotation.x=-.35;torso.rotation.y=Math.sin(t*.8)*.06;head.rotation.y=Math.sin(t*.8)*.1;
  }
  if(shieldPivot)shieldPivot.rotation.x=-shoulders[0].rotation.x-elbows[0].rotation.x-.13;
  if(state.reduced&&state.phase!=='down')motion.position.set(0,0,0);
  glow.emissiveIntensity=state.phase==='windup'?1.3+charge*1.5:state.phase==='attack'?3:1.3;
 }};
}
