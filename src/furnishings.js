import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const FURNITURE_PACKS = ['social', 'doors', 'bedroom', 'work', 'bath'];

export async function loadFurnishings(group) {
  const loader = new GLTFLoader();
  const results = await Promise.allSettled(FURNITURE_PACKS.map(async (room) => {
    const relativePath = `${import.meta.env.BASE_URL}models/${room}.glb`;
    const { scene } = await loader.loadAsync(relativePath);
    scene.name = room;
    scene.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = !node.material.transparent;
        node.receiveShadow = !node.material.transparent;
      }
    });
    group.add(scene);
  }));
  return results.filter((result) => result.status === 'rejected').length;
}
