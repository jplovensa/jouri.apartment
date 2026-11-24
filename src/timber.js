import * as THREE from 'three';
import baltimoreUrl from '../assets/materials/baltimore-teak.png?url';

let texturePromise;
let wardrobeTexturePromise;

function cleanTeakTexture() {
  if (!texturePromise) {
    texturePromise = new THREE.TextureLoader().loadAsync(baltimoreUrl).then((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
      texture.anisotropy = 8;
      texture.needsUpdate = true;
      return texture;
    });
  }
  return texturePromise;
}

export async function applyCleanTimber(group, procedural = false) {
  const materials = new Set();
  group.traverse((mesh) => {
    if (mesh.isMesh && /Closet teak|Baltimore teak|Entrance teak/i.test(mesh.material?.name || '')) materials.add(mesh.material);
  });
  // Keep the cabinet brown even if the texture cannot be loaded.
  for (const material of materials) {
    material.map = null;
    material.color.set('#5b3325');
    material.needsUpdate = true;
  }
  if (!materials.size) return;
  if (procedural && !wardrobeTexturePromise) wardrobeTexturePromise = cleanTeakTexture().then((source) => {
    const texture = source.clone();
    texture.flipY = true;
    texture.needsUpdate = true;
    return texture;
  });
  try {
    const texture = await (procedural ? wardrobeTexturePromise : cleanTeakTexture());
    for (const material of materials) {
      material.map = texture;
      material.color.set('#ffffff');
      material.needsUpdate = true;
    }
  } catch {
    // Matching solid colour remains visible when the optional image is unavailable.
  }
}
