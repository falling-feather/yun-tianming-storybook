// Source PNG rectangles and articulation landmarks; rendering is in painting.mjs.
export const frames = {
  masterConnected:{sheet:'connected',rect:[0,0,835,1024]},
  auntieConnected:{sheet:'connected',rect:[835,120,700,904]},
  princess:{sheet:'cast',rect:[30,0,348,486]},
  captain:{sheet:'cast',rect:[1430,0,285,495]},
  prince:{sheet:'cast',rect:[94,486,236,400]},
  tree:{sheet:'tree',rect:[0,0,1254,1254]},
  canopy:{sheet:'props',rect:[43,66,549,561]},
  voyageSea:{sheet:'voyageSea',rect:[0,0,1672,941]},
  voyageWater:{sheet:'voyageWater',rect:[0,0,1672,941]},
  voyageTravelers:{sheet:'voyageTravelers',rect:[0,0,1536,1024]},
  voyageSword:{sheet:'voyageSword',rect:[0,0,1536,1024]},
  corridor:{sheet:'background',rect:[0,0,836,471]},
  shore:{sheet:'background',rect:[0,471,836,470]},
};
export const sheets={cast:'characters.png',tree:'tree.png',background:'backgrounds.png',props:'living-props.png',connected:'connected-cast.png',voyageSea:'voyage-sea.png',voyageWater:'voyage-water-close.png',voyageTravelers:'voyage-travelers.png',voyageSword:'voyage-sword.png'};

// Landmarks belong to complete paintings, never to detached human limbs.
export const voyageArt={wideSoap:[1453,825],closeSoap:[1350,780],closeScale:.74};

// Source-pixel landmarks in the complete paintings; no separate sleeve/hand assets.
export const figures={
 master:{frame:'masterConnected',headY:46,foot:[439,1008],shoulder:[566,277],elbow:[635,390],wrist:[744,330],grip:[788,310],foreBand:[608,657],shoulderBlend:70,wristLimit:.72,elbowLimits:[.25,2.65],armRegion:[[554,266],[584,265],[648,304],[735,291],[783,251],[833,263],[833,367],[768,392],[742,495],[710,593],[627,596],[586,503],[572,419],[552,350],[552,300]]},
 auntie:{frame:'auntieConnected',headY:155,foot:[1230,1018],shoulder:[1118,356],elbow:[997,464],wrist:[922,380],grip:[869,349],foreBand:[1025,974],shoulderBlend:90,wristLimit:.72,elbowLimits:[.25,2.65],armRegion:[[1088,320],[1146,325],[1165,422],[1113,506],[1035,552],[967,557],[903,504],[893,422],[838,385],[837,304],[893,291],[947,330],[1007,349],[1060,350]]}
};
