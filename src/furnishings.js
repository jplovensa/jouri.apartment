import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const finishes = {
  teak: '#8a5034', dark: '#62391f', linen: '#ddcebc', white: '#f1ece2',
  sage: '#656a48', tile: '#65755b', rust: '#9a5036', stone: '#cbbfa9',
  black: '#282825', brass: '#a88b5c', glass: '#a6afa8',
};

function panelGrain(surface) {
  if (typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#dfc7b5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 76; i++) {
    const x = (i * 37) % 96;
    const opacity = .08 + (i % 11) * .016;
    ctx.strokeStyle = i % 3 ? `rgba(82,45,27,${opacity})` : `rgba(255,240,217,${opacity})`;
    ctx.lineWidth = i % 8 === 0 ? 2 : .48;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + (i % 7) - 3, 70, x - (i % 9) + 4, 180, x, 256);
    ctx.stroke();
  }
  surface.map = new THREE.CanvasTexture(canvas);
  surface.map.colorSpace = THREE.SRGBColorSpace;
}

export function furnish(group, box, material) {
  const materials = Object.fromEntries(Object.entries(finishes).map(([name, color]) => [name, material(color)]));
  panelGrain(materials.teak);
  const warmLight = new THREE.MeshBasicMaterial({ color: '#f8c286' });
  const glass = new THREE.MeshStandardMaterial({ color: '#c2d5cc', transparent: true, opacity: .22, roughness: .19, depthWrite: false });

  function asset(id, x, z) {
    const assembly = new THREE.Group();
    assembly.name = id;
    assembly.position.set(x, 0, z);
    group.add(assembly);
    return (w, h, d, px, py, pz, finish, radius = 0) => {
      const chosen = materials[finish] ?? finish;
      const mesh = radius
        ? new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius), chosen)
        : box(w, h, d, px, py, pz, chosen);
      mesh.position.set(px, py, pz);
      assembly.add(mesh);
      return mesh;
    };
  }

  // F01–F07, social rooms. The media wall is opposite the sofa cabinet;
  // the island is parallel to the kitchen, with the seats on its living-room side.
  const kitchen = asset('F03 Kitchen set', 5.925, 3.85);
  kitchen(.53, .80, 2.91, 0, .43, 0, 'sage');
  kitchen(.58, .055, 2.97, -.012, .858, 0, 'stone');
  kitchen(.32, .58, 2.65, .10, 1.65, -.15, 'teak');
  kitchen(.015, .035, 2.63, -.07, 1.352, -.15, warmLight);
  for (const z of [-1.16, -.69, -.22, .25, .72, 1.17]) {
    kitchen(.018, .67, .444, -.274, .43, z, 'sage');
    kitchen(.031, .018, .095, -.298, .69, z, 'brass');
  }
  for (const z of [-1.17, -.65, -.13, .39, .91]) kitchen(.018, .55, .49, -.068, 1.65, z, 'teak');
  kitchen(.35, .026, .43, -.04, .89, -1.16, 'glass', .009);
  kitchen(.027, .19, .027, .13, .97, -1.20, 'brass');
  kitchen(.38, .021, .43, -.04, .89, .54, 'black', .006);
  for (const z of [.43, .65]) kitchen(.15, .009, .15, -.04, .906, z, 'glass', .026);
  const appliance = asset('Kitchen tall appliance bank', 5.80, 5.56);
  appliance(.43, 1.94, .28, 0, .97, 0, 'teak');
  appliance(.36, 1.37, .034, -.018, .78, -.156, 'black');
  appliance(.11, .018, .03, -.06, 1.08, -.181, 'brass');

  const island = asset('F01 Kitchen island', 4.93, 5.00);
  island(.51, .74, 1.33, 0, .37, 0, 'teak');
  island(.60, .054, 1.43, -.045, .767, 0, 'stone');
  for (const z of [-.44, 0, .44]) island(.018, .57, .414, -.26, .392, z, 'teak');
  const stool = (id, z) => {
    const add = asset(id, 4.23, z);
    add(.365, .065, .355, 0, .55, 0, 'rust', .03);
    add(.055, .24, .35, -.14, .681, 0, 'rust', .02);
    for (const x of [-.13, .13]) for (const y of [-.125, .125]) add(.024, .52, .024, x, .26, y, 'black');
    add(.27, .018, .021, 0, .192, -.13, 'black');
  };
  stool('F02 Bar stool 1', 4.65);
  stool('F02 Bar stool 2', 5.24);

  const cycle = asset('F05 Tall bicycle cabinet', .37, 4.40);
  cycle(.49, 1.96, .91, 0, .98, 0, 'teak');
  for (const z of [-.225, .225]) cycle(.019, 1.86, .428, .251, .99, z, 'dark');
  const media = asset('F04 Media credenza', 1.87, 4.05);
  media(2.31, .30, .32, 0, .20, 0, 'teak');
  for (const x of [-.79, 0, .79]) media(.67, .19, .023, x, .209, .17, 'dark');
  for (const y of [.17, .21, .25]) media(.62, .012, .012, 0, y, .188, 'teak');
  const diningWall = asset('F06 Dining backdrop', 5.60, 6.20);
  diningWall(.085, 1.22, .90, 0, .61, 0, 'dark');
  diningWall(.20, .31, .85, -.075, .155, 0, 'teak');
  const banquette = asset('F07 Sofa cabinet', 2.55, 7.235);
  banquette(2.92, .39, .38, 0, .195, 0, 'teak');
  banquette(1.99, .07, .37, -.15, .425, -.005, 'linen', .022);
  for (const x of [-.92, -.31, .30, .92]) banquette(.56, .239, .018, x, .20, -.199, 'dark');

  // F15–F21, bedroom. Set out storage and vanity along the window side, the
  // bed on the 2.625 m wall and the display cabinet opposite the footboard.
  const bed = asset('F15–F16 Bedroom platform and headboard', 2.22, 1.19);
  bed(1.84, .29, 2.01, 0, .145, 0, 'teak');
  bed(1.76, .20, 1.95, 0, .40, .015, 'white', .04);
  bed(1.747, .058, 1.36, 0, .516, .29, 'linen', .024);
  bed(1.752, .04, .20, 0, .553, -.29, 'white', .018);
  for (const x of [-.45, .45]) {
    bed(.64, .12, .345, x, .56, -.707, 'white', .045);
    bed(.53, .105, .235, x, .588, -.442, 'sage', .039);
  }
  bed(2.18, .53, .081, .17, .335, -1.095, 'rust');
  bed(2.18, .043, .10, .17, .616, -1.082, 'teak');
  bed(2.02, .014, .025, .17, .58, -1.034, warmLight);
  const accessories = asset('F17 Accessories cabinet', .65, .48);
  accessories(.42, 1.59, .57, 0, .795, 0, 'teak');
  accessories(.025, 1.42, .50, .22, .81, 0, 'dark');
  const vanity = asset('F18–F19 Vanity and sliding mirror', .65, 1.35);
  vanity(.45, .67, .91, 0, .335, 0, 'teak');
  vanity(.47, .042, .94, 0, .69, 0, 'stone');
  vanity(.037, .60, .59, -.208, 1.03, .036, 'brass');
  vanity(.038, .566, .559, -.177, 1.03, .036, 'glass');
  const bags = asset('F20 Bag cabinet', .59, 3.37);
  bags(.54, 1.79, .40, 0, .895, 0, 'teak');
  for (const y of [.70, .99, 1.28, 1.57]) {
    bags(.45, .023, .28, 0, y, -.069, 'dark');
    bags(.41, .012, .023, 0, y + .014, -.216, warmLight);
  }
  const bedroomCabinet = asset('F21 Bedroom display cabinet', 2.10, 3.37);
  bedroomCabinet(2.32, .41, .40, 0, .205, 0, 'teak');
  bedroomCabinet(2.27, .035, .43, 0, .427, 0, 'stone');
  bedroomCabinet(.40, 1.12, .381, .92, .995, .013, 'teak');
  for (const y of [.66, .93, 1.20, 1.46]) {
    bedroomCabinet(.34, .02, .30, .92, y, -.036, 'dark');
    bedroomCabinet(.32, .012, .025, .92, y + .014, -.182, warmLight);
  }

  // F08–F12, working room. The daybed runs east–west, with a separate
  // clear aisle between the storage wall and the foot of the mattress.
  const daybed = asset('F08–F09 Working-room daybed', 2.83, 9.88);
  daybed(1.94, .29, 1.18, 0, .145, 0, 'teak');
  daybed(1.81, .18, 1.10, -.006, .382, 0, 'white', .035);
  daybed(1.18, .055, 1.087, -.29, .477, 0, 'linen', .019);
  daybed(.30, .109, .66, .657, .517, 0, 'sage', .045);
  daybed(.09, .77, 1.26, .965, .385, 0, 'teak');
  for (const x of [-.52, .52]) daybed(.47, .14, .019, x, .166, -.596, 'dark');
  const workStorage = asset('F10 Working-room cabinet', 1.20, 8.88);
  workStorage(.38, 1.82, .59, 0, .91, 0, 'teak');
  workStorage(.020, 1.71, .51, .20, .91, 0, 'sage');
  const desk = asset('F11 Working-room desk', 1.41, 9.54);
  desk(.42, .042, .57, 0, .745, 0, 'teak');
  desk(.37, .55, .034, -.023, .45, -.258, 'dark');
  desk(.031, .71, .048, .184, .355, .22, 'black');
  const workBackdrop = asset('F12 Working-room mosaic backdrop', 3.03, 10.77);
  workBackdrop(.88, 1.04, .045, 0, .52, 0, 'rust');
  for (let x = -.38; x < .41; x += .077) workBackdrop(.013, 1.015, .013, x, .525, -.029, 'dark');

  // F13–F14 and sanitary fittings. Layout matches the dedicated bathroom sheet.
  const vanityBath = asset('F13–F14 Bathroom vanity and shelves', 4.19, .46);
  vanityBath(.65, .37, .42, 0, .57, 0, 'teak');
  vanityBath(.66, .044, .44, 0, .781, 0, 'stone');
  vanityBath(.40, .044, .29, .045, .818, .02, 'white', .011);
  vanityBath(.033, .16, .033, .042, .896, -.136, 'brass');
  vanityBath(.057, .41, .29, -.327, 1.03, 0, 'teak');
  for (const y of [1.016, 1.208]) vanityBath(.14, .027, .29, -.277, y, 0, 'teak');
  const shower = asset('Bathroom shower enclosure', 5.25, .73);
  shower(.77, .075, .68, 0, .0375, 0, 'stone');
  shower(.75, 1.24, .026, 0, .62, -.332, 'tile');
  for (const x of [-.30, -.16, -.02, .12, .26]) shower(.01, 1.24, .009, x, .62, -.316, 'sage');
  shower(.023, 1.12, .63, .385, .59, -.013, glass);
  shower(.023, 1.12, .027, .386, .59, .31, 'brass');
  const toilet = asset('Bathroom WC', 5.72, 1.72);
  toilet(.52, .33, .37, -.04, .19, 0, 'white', .045);
  toilet(.42, .064, .37, -.099, .386, 0, 'white', .044);
  toilet(.15, .48, .40, .18, .255, 0, 'white', .017);
}
