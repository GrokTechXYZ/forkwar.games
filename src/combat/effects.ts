import * as THREE from 'three';

export interface EffectState {
 phase:string;progress:number;time:number;ability?:string;kind:string;source:THREE.Vector3;
 targets:THREE.Vector3[];allies:THREE.Vector3[];reduced:boolean;eventKey:number;
}
export interface CombatEffects {root:THREE.Group;update:(state:EffectState)=>void;dispose:()=>void}

/** Pooled geometric effects; their only clock is the paused/speed-adjusted replay clock. */
export function createCombatEffects():CombatEffects {
 const root=new THREE.Group();root.name='combat-3d-effects';
 const geometries:THREE.BufferGeometry[]=[];const materials:THREE.Material[]=[];
 const geo=<T extends THREE.BufferGeometry>(g:T)=>{geometries.push(g);return g;};
 const basic=(color:number,opacity=1)=>{const m=new THREE.MeshBasicMaterial({color,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});materials.push(m);return m;};
 const glowMat=basic(0x95ffe8),coreMat=basic(0xffffdb),ringMat=basic(0x95ffe8,.6),sparkMat=basic(0xffd289);
 const shieldMat=new THREE.MeshPhysicalMaterial({color:0x9cbcff,emissive:0x668aff,emissiveIntensity:.4,roughness:.14,metalness:.1,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide});materials.push(shieldMat);
 const ballGeo=geo(new THREE.IcosahedronGeometry(1,1)),beamGeo=geo(new THREE.CylinderGeometry(1,1,1,6)),ringGeo=geo(new THREE.TorusGeometry(1,.025,6,48)),shieldGeo=geo(new THREE.SphereGeometry(1,20,12)),arcGeo=geo(new THREE.TorusGeometry(1,.07,6,24,Math.PI*.9));
 const pooled=(g:THREE.BufferGeometry,m:THREE.Material,count:number)=>Array.from({length:count},()=>{const mesh=new THREE.Mesh(g,m);mesh.visible=false;root.add(mesh);return mesh;});
 const beams=pooled(beamGeo,glowMat,36),cores=pooled(beamGeo,coreMat,18),flares=pooled(ballGeo,glowMat,24),rings=pooled(ringGeo,ringMat,18),shields=pooled(shieldGeo,shieldMat,18),arcs=pooled(arcGeo,glowMat,3);
 const sparkCount=180,sparks=new THREE.InstancedMesh(ballGeo,sparkMat,sparkCount);sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);sparks.frustumCulled=false;root.add(sparks);
 const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),v=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),direction=new THREE.Vector3(),scale=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
 const allMeshes=[...beams,...cores,...flares,...rings,...shields,...arcs];let beamIndex=0,coreIndex=0,flareIndex=0,ringIndex=0,sparkIndex=0;
 const beam=(from:THREE.Vector3,to:THREE.Vector3,width:number,core=true)=>{
  const mesh=beams[beamIndex++];if(!mesh)return;direction.subVectors(to,from);const length=direction.length();if(length<.001)return;
  mesh.visible=true;mesh.position.copy(from).add(to).multiplyScalar(.5);mesh.scale.set(width,length,width);mesh.quaternion.setFromUnitVectors(up,direction.normalize());
  if(core){const inner=cores[coreIndex++];if(inner){inner.visible=true;inner.position.copy(mesh.position);inner.quaternion.copy(mesh.quaternion);inner.scale.set(width*.35,length,width*.35);}}
 };
 const flare=(point:THREE.Vector3,radius:number)=>{const mesh=flares[flareIndex++];if(!mesh)return;mesh.visible=true;mesh.position.copy(point);mesh.scale.setScalar(Math.max(.005,radius));};
 const ring=(point:THREE.Vector3,radius:number,vertical=false)=>{const mesh=rings[ringIndex++];if(!mesh)return;mesh.visible=true;mesh.position.copy(point);mesh.scale.setScalar(Math.max(.005,radius));mesh.rotation.set(vertical?0:-Math.PI/2,0,0);};
 const spark=(point:THREE.Vector3,age:number,index:number,thermal:boolean,seed:number)=>{
  if(sparkIndex>=sparkCount)return;
  const angle=index*2.399+seed*.23,speed=.7+(index%5)*.36;
  posSpark(point,Math.cos(angle)*speed*age,(.4+index%4*.18)*age-(thermal?.45:1.3)*age*age,Math.sin(angle)*speed*age,thermal?.08:.045,index);
 };
 const posSpark=(point:THREE.Vector3,x:number,y:number,z:number,size:number,index:number)=>{
  v.copy(point).add(a.set(x,y,z));scale.set(size,size*(index%2?2.4:1),size);q.setFromAxisAngle(up,index);matrix.compose(v,q,scale);sparks.setMatrixAt(sparkIndex++,matrix);
 };
 const color=new THREE.Color(),white=new THREE.Color(0xffffff);
 const update=(state:EffectState)=>{
  allMeshes.forEach(mesh=>{mesh.visible=false;});sparks.count=0;
  beamIndex=coreIndex=flareIndex=ringIndex=sparkIndex=0;
  const {phase,ability,source,targets,allies,reduced,eventKey}=state,p=Math.max(0,Math.min(1,state.progress));
  const thermal=ability==='fx-fire',consensus=ability==='fx-signal',guardian=ability==='fx-guard',charged=ability==='fx-charge';
  const melee=guardian||['guardian','warden','sentinel'].includes(state.kind);
  const active=phase==='windup'||phase==='impact'||phase==='recover';if(!active)return;
  color.setHex(thermal?0xff962f:guardian?0xabc8ff:consensus?0x61ffe0:charged?0xff8562:state.kind==='striker'?0xffc26f:0xaffeeb);
  glowMat.color.copy(color);ringMat.color.copy(color);sparkMat.color.copy(color).lerp(white,.35);
  glowMat.opacity=phase==='recover'?1-p:.9;ringMat.opacity=phase==='recover'?.25*(1-p):.65;
  if(reduced){
   if(phase==='impact')for(const target of targets.slice(0,9)){flare(target,.13);}
   return;
  }
  if(phase==='windup'){
   if(ability){flare(source,.07+p*.17);ring(source,.12+p*.2,true);}
   if(!melee&&p>.72&&targets[0]){
    const t=(p-.72)/.28;a.copy(source).lerp(targets[0],t);b.copy(source).lerp(targets[0],Math.max(0,t-.18));beam(b,a,thermal?.09:.035);flare(a,thermal?.15:.075);
   }
   if(thermal){for(let i=0;i<10;i++){const angle=i*Math.PI/5+state.time*5;posSpark(source,Math.cos(angle)*.25,.13*Math.sin(angle*2),Math.sin(angle)*.25,.035,i);}}
  }
  if(phase==='impact'||phase==='recover'){
   const age=phase==='impact'?p:.8+p*.3;
   flare(source,(phase==='impact'?.21:.06)*(1-p*.7));
   targets.slice(0,9).forEach((target,index)=>{
    if(consensus){
     const from=index===0?source:targets[index-1];const segments=3;
     for(let segment=0;segment<segments;segment++){
      a.copy(from).lerp(target,segment/segments);b.copy(from).lerp(target,(segment+1)/segments);
      if(segment>0)a.y+=.18*Math.sin(eventKey+segment*2);if(segment<segments-1)b.y+=.18*Math.sin(eventKey+(segment+1)*2);
      beam(a,b,.04*(1-p*.55));
     }
    }else if(thermal){
     // Broad hot ribbons and a vertical plume distinguish the area blast from gunfire.
     a.copy(source);b.copy(target);beam(a,b,.09*(1-p*.7));
     a.copy(target);a.y=.12;ring(a,.35+age*1.15);
     for(let i=0;i<10;i++)spark(target,age*.85+.04,i,true,eventKey+index*7);
     flare(target,.24*(1-p*.5));
    }else if(!melee&&phase==='impact'&&p<.45){beam(source,target,charged?.09:.024);}
    if(!thermal){for(let i=0;i<7;i++)spark(target,age*.78+.02,i,false,eventKey+index*4);flare(target,.13*(1-p*.75));}
    if(melee){a.copy(target);a.y=.06;ring(a,.28+age*1.7);}
   });
   if(guardian){
    allies.slice(0,18).forEach((point,index)=>{
     const shield=shields[index];shield.visible=true;shield.position.copy(point);shield.position.y=1.24;shield.scale.set(1.05,1.7,1.05);
     a.copy(point);a.y=.1;ring(a,.85+Math.sin(age*Math.PI)*.1);
    });
    shieldMat.opacity=(phase==='impact'?.2:.16)*(1-p*.35);
   }
   if(melee&&targets[0]){
    const arc=arcs[0];arc.visible=true;arc.position.copy(source).lerp(targets[0],.5);arc.rotation.set(-Math.PI/2,0,-Math.atan2(targets[0].z-source.z,targets[0].x-source.x)+Math.PI*.1);arc.scale.setScalar(.65+p*.55);
   }
  }
  sparks.count=sparkIndex;sparks.instanceMatrix.needsUpdate=true;
 };
 return {root,update,dispose:()=>{for(const g of new Set(geometries))g.dispose();for(const m of new Set(materials))m.dispose();root.clear();}};
}
