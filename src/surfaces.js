import * as THREE from 'three';

const maps = new Map();

function createMap(name, size, fill, repeat = [1, 1], colorSpace = THREE.NoColorSpace) {
  if (typeof document === 'undefined') return null;
  if (maps.has(name)) return maps.get(name);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const color = fill(x, y, size);
      const pixel = (y * size + x) * 4;
      if (Array.isArray(color)) image.data.set([...color, 255], pixel);
      else image.data.set([color, color, color, 255], pixel);
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = colorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = 8;
  maps.set(name, texture);
  return texture;
}

function grain(x, y, seed = 0) {
  let hash = Math.imul(x + seed * 1457, 374761393) + Math.imul(y + 489, 668265263);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295;
}

const detail = {
  cotton: { bump: .0012, roughness: .91, color: true },
  linen: { bump: .0017, roughness: .88, color: true },
  timber: { bump: .001, roughness: .46 },
  burl: { bump: .0013, roughness: .49, color: true },
  stone: { bump: .00045, roughness: .38 },
  ceramic: { bump: .00033, roughness: .24 },
  glaze: { bump: .0006, roughness: .32, color: true },
  steel: { bump: .00018, roughness: .32 },
  laminate: { bump: .00045, roughness: .53 },
};

function textureDetail(type, x, y) {
  const noise = grain(x, y);
  if (type === 'cotton' || type === 'linen') {
    const stride = type === 'linen' ? 5 : 4;
    return 138 + 31 * Math.cos(x * Math.PI * 2 / stride) +
      31 * Math.cos(y * Math.PI * 2 / stride) + 14 * noise + 6 * Math.sin((x + y) * .18);
  }
  if (type === 'timber') return 122 + 24 * Math.sin(x * .50 + .6 * Math.sin(y / 22)) + 21 * grain(x, y >> 3, 2);
  if (type === 'burl') {
    const curl = Math.hypot((x - 127) * 1.3, (y - 125) * .74);
    return 150 + 28 * Math.sin(curl * .38 + 2 * Math.sin(x * .09) * Math.cos(y * .07)) + 35 * noise;
  }
  if (type === 'stone' || type === 'glaze') return 145 + 19 * noise + 11 * Math.sin(y * .19 + x * .13) + 9 * Math.sin(y * .43 - x * .11);
  if (type === 'steel') return 145 + 39 * grain(4, y, 7) + 8 * noise;
  return 129 + 35 * noise;
}

function finishType(name) {
  if (/shower glass|Warm.*lighting/i.test(name)) return '';
  if (/cotton/i.test(name)) return 'cotton';
  if (/linen|olive woven|upholstery|piping|stitching/i.test(name)) return 'linen';
  if (/burl/i.test(name)) return 'burl';
  if (/teak/i.test(name)) return 'timber';
  if (/granite/i.test(name)) return 'stone';
  if (/mosaic|tile|terracotta/i.test(name)) return 'glaze';
  if (/ceramic/i.test(name)) return 'ceramic';
  if (/metal|brass|mirror/i.test(name)) return 'steel';
  return 'laminate';
}

const processed = new WeakSet();
export function finishFurniture(material) {
  if (!material || processed.has(material)) return;
  processed.add(material);
  const type = finishType(material.name || '');
  const profile = detail[type];
  if (!profile) {
    material.envMapIntensity = .92;
    return;
  }
  const repeat = type === 'cotton' || type === 'linen' ? [4.5, 4.5] : type === 'steel' ? [3, 3] : [1.5, 1.5];
  material.bumpMap = createMap(`${type}-height`, 256, (x, y) => textureDetail(type, x, y), repeat);
  material.bumpScale = profile.bump;
  material.roughness = profile.roughness;
  material.roughnessMap = createMap(`${type}-roughness`, 256, (x, y) => {
    const value = textureDetail(type, x, y);
    return 210 + value * .17;
  }, repeat);
  if (!material.map && profile.color) material.map = createMap(`${type}-cloth-color`, 256, (x, y) =>
    211 + textureDetail(type, x, y) * .155, repeat, THREE.SRGBColorSpace);
  if (material.map) material.map.anisotropy = 8;
  material.envMapIntensity = type === 'steel' ? 1.1 : .87;
  material.needsUpdate = true;
}

export function floorFinish(material, planks) {
  const type = planks ? 'plank' : 'tile';
  const repeat = planks ? [1 / 1.28, 1 / .92] : [1 / 1.20, 1 / 1.20];
  const height = (x, y, size) => {
    const edge = Math.floor(size / 2);
    if (!planks) {
      if (x % edge < 2 || y % edge < 2) return 104;
      const cloud = 9 * Math.sin(x * .049 + y * .058 + 1.8 * Math.sin((x - y) * .027))
        + 3.5 * Math.sin((x + y) * .131) + grain(x, y) * 8;
      return 216 + cloud + ((x < edge ? 0 : 1) + (y < edge ? 3 : 0));
    }
    const board = Math.floor(y / 43);
    const joint = (x + board * 87) % 256;
    if (y % 43 < 1 || joint < 1) return 116;
    return 185 + 5 * board + 17 * Math.sin(y * .43 + 1.3 * Math.sin(x / 32) + board)
      + 11 * grain(x >> 3, y, board) + grain(x, y) * 9;
  };
  material.map = createMap(`${type}-color`, 256, (x, y, size) => height(x, y, size), repeat, THREE.SRGBColorSpace);
  material.bumpMap = createMap(`${type}-height`, 256, height, repeat);
  material.bumpScale = planks ? .0018 : .002;
  material.roughness = planks ? .49 : .34;
  material.roughnessMap = createMap(`${type}-roughness`, 256, (x, y, size) => 210 + height(x, y, size) * .16, repeat);
}

export function paintFinish(material) {
  material.bumpMap = createMap('paint-stipple', 128, (x, y) => 121 + 49 * grain(x, y), [14, 14]);
  material.bumpScale = .00058;
  material.roughness = .89;
}
