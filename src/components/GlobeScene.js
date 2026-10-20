import * as THREE from 'three';

/**
 * GlobeScene: Quản lý Quả cầu 3D với 19 điểm sáng chân dung theo chuẩn điện ảnh:
 * - Nền không gian sâu với các vì sao có độ sáng khác nhau
 * - Ánh sáng khí quyển mảnh và có chiều sâu
 * - 19 ảnh chân dung nằm trên mặt cầu, khung tròn viền champagne gold và hào quang nhẹ
 * - Che khuất mặt sau tự nhiên (Backface Culling theo góc nhìn)
 * - Xoay có quán tính mượt mà, ưu tiên tương tác người dùng
 */
export class GlobeScene {
  constructor(container, users, options = {}) {
    this.container = container;
    this.users = users;
    this.onSelectUser = options.onSelectUser || (() => {});
    this.onHoverUser = options.onHoverUser || (() => {});

    this.radius = 10;
    this.markers = [];
    this.selectedMarker = null;

    // Trạng thái tương tác & quán tính
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.rotationVelocity = { x: 0, y: 0.0015 };
    this.targetRotation = { x: 0.1, y: 0 };
    this.currentRotation = { x: 0.1, y: 0 };
    this.autoRotate = true;
    this.isTargeting = false;
    this.targetQuat = null;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-999, -999);

    this.init();
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    // 1. Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 28);

    // 2. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);

    // 3. Ánh sáng
    const ambientLight = new THREE.AmbientLight(0x0a1628, 1.2);
    this.scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xfff6df, 2.2);
    mainLight.position.set(15, 12, 20);
    this.scene.add(mainLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.5);
    rimLight.position.set(-15, -10, -10);
    this.scene.add(rimLight);

    const goldRim = new THREE.PointLight(0xd4af37, 2.0, 50);
    goldRim.position.set(0, 15, 10);
    this.scene.add(goldRim);

    // 4. Các lớp không gian & Địa cầu
    this.createStarfield();
    this.createGlobeGroup();
    this.createMarkers();

    // 5. Sự kiện
    this.bindEvents();

    // 6. Loop
    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  /**
   * Tạo nền sao không gian sâu với kích thước và độ sáng ngẫu nhiên
   */
  createStarfield() {
    const starCount = 1800;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);

    const colorPalette = [
      new THREE.Color(0xffffff),
      new THREE.Color(0xfde68a), // gold tint
      new THREE.Color(0x7dd3fc), // soft cyan
      new THREE.Color(0xe0e7ff)  // soft blue-white
    ];

    for (let i = 0; i < starCount; i++) {
      const r = 80 + Math.random() * 80;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = 1.0 + Math.random() * 2.2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Canvas texture cho hạt sao mềm mại không bị vỡ hạt
    const starCanvas = document.createElement('canvas');
    starCanvas.width = 32;
    starCanvas.height = 32;
    const ctx = starCanvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(240, 245, 255, 0.8)');
    grad.addColorStop(0.8, 'rgba(120, 180, 255, 0.2)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);

    const starTexture = new THREE.CanvasTexture(starCanvas);
    const starMaterial = new THREE.PointsMaterial({
      size: 1.6,
      map: starTexture,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.starPoints = new THREE.Points(geometry, starMaterial);
    this.scene.add(this.starPoints);
  }

  /**
   * Tạo địa cầu chính với vân lưới kinh vĩ độ và lớp khí quyển mềm mại
   */
  createGlobeGroup() {
    this.globeGroup = new THREE.Group();
    this.scene.add(this.globeGroup);

    // 1. Quả cầu trung tâm
    const globeGeo = new THREE.SphereGeometry(this.radius, 64, 64);
    
    // Tạo texture lưới địa cầu cinematic thủ công bằng Canvas
    const gridTexture = this.generateGlobeGridTexture();
    const globeMat = new THREE.MeshStandardMaterial({
      color: 0x050c1e,
      roughness: 0.65,
      metalness: 0.35,
      map: gridTexture,
      emissive: 0x071530,
      emissiveIntensity: 0.35
    });

    this.globeMesh = new THREE.Mesh(globeGeo, globeMat);
    this.globeGroup.add(this.globeMesh);

    // 2. Lớp khí quyển mảnh hào quang (Atmosphere rim glow)
    const atmosGeo = new THREE.SphereGeometry(this.radius * 1.035, 64, 64);
    const atmosMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.65 - dot(vNormal, vec3(0, 0, 1.0)), 2.8);
          // Hào quang chuyển dần từ vàng champagne ở rìa cực sát đến xanh đêm huyền ảo
          vec3 glowColor = mix(vec3(0.08, 0.28, 0.55), vec3(0.83, 0.68, 0.21), intensity * 0.45);
          gl_FragColor = vec4(glowColor, intensity * 0.85);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false
    });

    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    this.globeGroup.add(atmosMesh);

    // 3. Vòng quỹ đạo ánh sáng trang nhã (Celestial latitude rings)
    const ringGeo = new THREE.RingGeometry(this.radius * 1.15, this.radius * 1.16, 96);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xd4af37,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2.3;
    this.globeGroup.add(ring);
  }

  /**
   * Sinh texture lưới kinh vĩ độ và các điểm sáng constellation cao cấp
   */
  generateGlobeGridTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Nền gradient xanh thẳm
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 1024);
    bgGrad.addColorStop(0, '#040915');
    bgGrad.addColorStop(0.5, '#071224');
    bgGrad.addColorStop(1, '#040915');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 2048, 1024);

    // Vẽ lưới vĩ độ (Latitude)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1.2;
    for (let y = 0; y <= 1024; y += 1024 / 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(2048, y);
      ctx.stroke();
    }

    // Vẽ lưới kinh độ (Longitude)
    for (let x = 0; x <= 2048; x += 2048 / 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1024);
      ctx.stroke();
    }

    // Đường xích đạo viền vàng champagne sáng nhẹ
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.3)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 512);
    ctx.lineTo(2048, 512);
    ctx.stroke();

    // Các điểm hạt ánh sao ngẫu nhiên trên bề mặt địa cầu
    ctx.fillStyle = 'rgba(255, 235, 170, 0.4)';
    for (let i = 0; i < 400; i++) {
      const rx = Math.random() * 2048;
      const ry = Math.random() * 1024;
      const sz = Math.random() * 1.5 + 0.5;
      ctx.beginPath();
      ctx.arc(rx, ry, sz, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  /**
   * Tạo Texture Hào quang Vương miện Tinh tú (Celestial Corona):
   * - Tia sáng hoàng kim và ánh sao tỏa đều bao quanh mép ngoài của viền
   * - Độ dài tia sáng vừa vặn, không đè lấn sang ảnh bên cạnh
   */
  createCoronaTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const cx = 256;
    const cy = 256;

    // 1. Quầng sáng mềm bám sát mép ngoài của viền kim loại
    const radGrad = ctx.createRadialGradient(cx, cy, 155, cx, cy, 255);
    radGrad.addColorStop(0, 'rgba(212, 175, 55, 0)');
    radGrad.addColorStop(0.12, 'rgba(255, 240, 170, 0.95)'); // Sáng rực rỡ bám sát viền
    radGrad.addColorStop(0.45, 'rgba(212, 175, 55, 0.45)');  // Ánh vàng champagne tỏa nhẹ
    radGrad.addColorStop(0.8, 'rgba(56, 189, 248, 0.12)');   // Sắc xanh huyền ảo
    radGrad.addColorStop(1.0, 'rgba(212, 175, 55, 0)');
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 256, 0, Math.PI * 2);
    ctx.fill();

    // 2. 24 tia sáng vương miện tinh tú (Celestial Rays) có độ dài vừa vặn, tinh tế
    const rayCount = 24;
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2;
      const isMajor = i % 4 === 0;
      const isMedium = i % 2 === 0;
      const rayLen = isMajor ? 58 : (isMedium ? 40 : 28);

      const rStart = 162;
      const rEnd = rStart + rayLen;

      const x1 = cx + Math.cos(angle) * rStart;
      const y1 = cy + Math.sin(angle) * rStart;
      const x2 = cx + Math.cos(angle) * rEnd;
      const y2 = cy + Math.sin(angle) * rEnd;

      const rayGrad = ctx.createLinearGradient(x1, y1, x2, y2);
      rayGrad.addColorStop(0, isMajor ? 'rgba(255, 255, 230, 0.95)' : 'rgba(255, 225, 140, 0.8)');
      rayGrad.addColorStop(0.5, 'rgba(212, 175, 55, 0.4)');
      rayGrad.addColorStop(1, 'rgba(212, 175, 55, 0)');

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = rayGrad;
      ctx.lineWidth = isMajor ? 2.8 : (isMedium ? 1.8 : 1.1);
      ctx.stroke();
    }

    // 3. Bốn điểm lấp lánh kim cương ở 4 phương vị chính
    const diamondAngles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
    diamondAngles.forEach(ang => {
      const fx = cx + Math.cos(ang) * 165;
      const fy = cy + Math.sin(ang) * 165;
      ctx.save();
      ctx.translate(fx, fy);
      const fGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 12);
      fGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      fGrad.addColorStop(0.4, 'rgba(255, 230, 150, 0.8)');
      fGrad.addColorStop(1, 'rgba(212, 175, 55, 0)');
      ctx.fillStyle = fGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = true;
    return texture;
  }

  /**
   * Tạo 19 điểm sáng chân dung đặt ở 2 hàng xen kẽ dọc theo đường xích đạo:
   * - Khoảng cách vàng: ĐỦ GẦN để tạo cảm giác gắn kết ấm cúng, ĐỦ XA để tuyệt đối không chạm vào nhau
   * - Hướng của ảnh LUÔN THẲNG ĐỨNG (Đầu hướng Cực Bắc, Chân hướng Cực Nam)
   */
  createMarkers() {
    const total = this.users.length;
    const row1Count = 10;
    const row2Count = total - row1Count; // 9

    // Xáo trộn ngẫu nhiên thứ tự người dùng nhưng giữ cố định
    const shuffledUsers = [...this.users].map((u, i) => ({ user: u, originalIndex: i }));
    shuffledUsers.sort((a, b) => {
      const hashA = Math.sin(a.originalIndex * 9301 + 49297) % 1;
      const hashB = Math.sin(b.originalIndex * 9301 + 49297) % 1;
      return hashA - hashB;
    });

    // Tạo Texture Hào quang Vương miện sắc sảo mới
    const coronaTexture = this.createCoronaTexture();

    shuffledUsers.forEach((item, index) => {
      const user = item.user;
      const isRow1 = index < row1Count;
      const rowIndex = isRow1 ? index : (index - row1Count);
      const rowTotal = isRow1 ? row1Count : row2Count;

      // 1. TỌA ĐỘ 2 HÀNG "KHOẢNG CÁCH VÀNG" (~12.6 độ Bắc & Nam):
      // Đủ gần nhau một chút để các ảnh tạo thành một dải ngân hà liền mạch,
      // nhưng duy trì khoảng cách hở tối thiểu ~1.24 đơn vị 3D giữa các mép viền, tuyệt đối không chạm vào nhau!
      const latAngle = isRow1 ? 0.22 : -0.22; // ~12.6 độ

      // Kinh độ: trải đều 360 độ quanh trục xích đạo
      // Hàng 2 lệch nửa bước so le tổ ong
      const phaseOffset = isRow1 ? 0 : (Math.PI / rowTotal);
      const lonAngle = (rowIndex / rowTotal) * Math.PI * 2 + phaseOffset;

      const y = this.radius * Math.sin(latAngle);
      const radiusAtY = this.radius * Math.cos(latAngle);
      const x = radiusAtY * Math.cos(lonAngle);
      const z = radiusAtY * Math.sin(lonAngle);

      const normal = new THREE.Vector3(x, y, z).normalize();
      const pos = normal.clone().multiplyScalar(this.radius * 1.025);

      // 2. Nhóm Marker
      const markerGroup = new THREE.Group();
      markerGroup.position.copy(pos);

      // ĐỊNH HƯỚNG THẲNG ĐỨNG CHUẨN XÁC TUYỆT ĐỐI (Đầu lên trên, chân xuống dưới):
      const worldUp = new THREE.Vector3(0, 1, 0);
      const yDir = worldUp.clone().sub(normal.clone().multiplyScalar(worldUp.dot(normal))).normalize();
      const xDir = new THREE.Vector3().crossVectors(yDir, normal).normalize();
      const basisMatrix = new THREE.Matrix4().makeBasis(xDir, yDir, normal);
      markerGroup.quaternion.setFromRotationMatrix(basisMatrix);

      // 3. Sprite Hào quang Vương miện tinh tú đặt PHÍA SAU (z = -0.02)
      const coronaMat = new THREE.SpriteMaterial({
        map: coronaTexture,
        color: 0xfff0c2,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const coronaSprite = new THREE.Sprite(coronaMat);
      coronaSprite.scale.set(4.2, 4.2, 1.0);
      coronaSprite.position.z = -0.02; // Phía sau ảnh
      markerGroup.add(coronaSprite);

      // 4. Khung tròn ảnh chân dung ở phía trước (z = 0.02) - Bán kính 1.40 siêu nét, to rõ
      const avatarMesh = this.createAvatarMesh(user);
      avatarMesh.position.z = 0.02;
      markerGroup.add(avatarMesh);

      // 5. Viền kim loại Champagne Gold 3D ở trước nhất (z = 0.04)
      const rimGeo = new THREE.RingGeometry(1.38, 1.56, 64);
      const rimMat = new THREE.MeshStandardMaterial({
        color: 0xf3d68c,
        metalness: 0.9,
        roughness: 0.18,
        side: THREE.DoubleSide
      });
      const rimMesh = new THREE.Mesh(rimGeo, rimMat);
      rimMesh.position.z = 0.04;
      markerGroup.add(rimMesh);

      // 6. Hit Box rộng cho Raycasting nhận diện chuẩn xác
      const hitGeo = new THREE.SphereGeometry(1.65, 16, 16);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.userData = { user, markerGroup, coronaSprite, rimMesh, index };
      markerGroup.add(hitMesh);

      this.globeGroup.add(markerGroup);

      this.markers.push({
        user,
        index,
        group: markerGroup,
        normal,
        coronaSprite,
        rimMesh,
        hitMesh,
        avatarMesh,
        baseHaloScale: 4.2,
        pulseOffset: Math.random() * Math.PI * 2
      });
    });
  }

  /**
   * Tạo mesh chân dung độ phân giải cao, tối ưu độ rõ nét và cân chỉnh trọng tâm khuôn mặt
   */
  createAvatarMesh(user) {
    const avatarCanvas = document.createElement('canvas');
    avatarCanvas.width = 512;
    avatarCanvas.height = 512;
    const aCtx = avatarCanvas.getContext('2d');

    this.drawAvatarPlaceholder(aCtx, user.name);

    const texture = new THREE.CanvasTexture(avatarCanvas);
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    if (this.renderer && this.renderer.capabilities) {
      texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = encodeURI(user.image);
    img.onload = () => {
      aCtx.clearRect(0, 0, 512, 512);

      // 1. Lớp đế màu đậm bên dưới chống nhìn xuyên thấu
      aCtx.fillStyle = '#060e1f';
      aCtx.beginPath();
      aCtx.arc(256, 256, 248, 0, Math.PI * 2);
      aCtx.fill();

      // 2. Cắt tròn sắc nét
      aCtx.save();
      aCtx.beginPath();
      aCtx.arc(256, 256, 246, 0, Math.PI * 2);
      aCtx.closePath();
      aCtx.clip();

      // 3. Tối ưu vùng cắt: Đưa trọng tâm lên phía trên ~22% để khuôn mặt người lọt trọn vẹn vào giữa
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = Math.max(0, (img.height - minDim) * 0.22);
      aCtx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 512, 512);
      aCtx.restore();

      // 4. Viền vàng tinh xảo mảnh bên trong làm nổi bật bức ảnh
      aCtx.save();
      aCtx.beginPath();
      aCtx.arc(256, 256, 246, 0, Math.PI * 2);
      aCtx.strokeStyle = 'rgba(255, 235, 160, 0.92)';
      aCtx.lineWidth = 8;
      aCtx.stroke();
      aCtx.restore();

      texture.needsUpdate = true;
    };

    const geometry = new THREE.CircleGeometry(1.40, 64);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.FrontSide
    });

    return new THREE.Mesh(geometry, material);
  }

  /**
   * Placeholder chữ cái đầu nếu ảnh đang tải
   */
  drawAvatarPlaceholder(ctx, name) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 512);

    ctx.save();
    ctx.beginPath();
    ctx.arc(256, 256, 246, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 12;
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 150px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.charAt(0).toUpperCase(), 256, 256);
    ctx.restore();
  }

  /**
   * Đăng ký tương tác chuột và chạm
   */
  bindEvents() {
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onResize = this.onResize.bind(this);

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    window.addEventListener('pointermove', this.onPointerMove, { passive: false });
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('resize', this.onResize);
  }

  onPointerDown(e) {
    this.isDragging = true;
    this.autoRotate = false;
    this.dragMoved = false;
    this.downPosition = { x: e.clientX, y: e.clientY };
    this.previousMousePosition = { x: e.clientX, y: e.clientY };
  }

  onPointerMove(e) {
    // Cập nhật tọa độ chuột cho Raycasting
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    if (this.isDragging) {
      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;

      if (Math.abs(e.clientX - this.downPosition.x) > 4 || Math.abs(e.clientY - this.downPosition.y) > 4) {
        this.dragMoved = true;
      }

      // Xoay địa cầu theo thao tác người dùng (ưu tiên tuyệt đối)
      this.rotationVelocity.y = deltaX * 0.0035;
      this.rotationVelocity.x = deltaY * 0.0035;

      this.globeGroup.rotation.y += this.rotationVelocity.y;
      this.globeGroup.rotation.x = Math.max(-0.35, Math.min(0.35, this.globeGroup.rotation.x + this.rotationVelocity.x));

      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    } else {
      // Raycast hover khi di chuột
      this.checkHover();
    }
  }

  onPointerUp(e) {
    if (!this.isDragging) return;
    this.isDragging = false;

    // Nếu không kéo rê đáng kể thì tính là Click chọn điểm sáng
    if (!this.dragMoved) {
      this.checkClick(e);
    }
  }

  /**
   * Kiểm tra chọn ảnh khi click
   */
  checkClick() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hitMeshes = this.markers.map(m => m.hitMesh);
    const intersects = this.raycaster.intersectObjects(hitMeshes);

    if (intersects.length > 0) {
      // Tìm điểm gần nhất thỏa mãn: ở mặt trước (không bị che bởi mặt cầu)
      for (const hit of intersects) {
        const marker = this.markers.find(m => m.hitMesh === hit.object);
        if (marker && this.isMarkerFrontFacing(marker)) {
          this.selectMarker(marker);
          break;
        }
      }
    }
  }

  /**
   * Kiểm tra hover
   */
  checkHover() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hitMeshes = this.markers.map(m => m.hitMesh);
    const intersects = this.raycaster.intersectObjects(hitMeshes);

    let hovered = null;
    if (intersects.length > 0) {
      for (const hit of intersects) {
        const marker = this.markers.find(m => m.hitMesh === hit.object);
        if (marker && this.isMarkerFrontFacing(marker)) {
          hovered = marker;
          break;
        }
      }
    }

    if (hovered) {
      this.renderer.domElement.style.cursor = 'pointer';
      this.onHoverUser(hovered.user);
    } else {
      this.renderer.domElement.style.cursor = 'grab';
      this.onHoverUser(null);
    }
  }

  /**
   * Tính toán xem marker có đang ở mặt trước (hướng về camera) hay không
   * Quy tắc B: Ảnh ở mặt sau phải bị che khuất tự nhiên
   */
  isMarkerFrontFacing(marker) {
    // Vector pháp tuyến thế giới của marker
    const worldNormal = marker.normal.clone().applyQuaternion(this.globeGroup.quaternion).normalize();
    // Hướng nhìn từ camera tới tâm địa cầu
    const cameraDirection = new THREE.Vector3(0, 0, 1);
    const dot = worldNormal.dot(cameraDirection);
    return dot > 0.15; // > 0 là mặt trước, lấy ngưỡng 0.15 để fade mượt ở viền
  }

  /**
   * Chọn một điểm sáng: Làm nổi bật viền và xoay từ từ để hướng về người xem
   */
  selectMarker(marker) {
    this.selectedMarker = marker;

    // Giảm tốc độ quay
    this.rotationVelocity = { x: 0, y: 0 };
    this.autoRotate = false;

    // Hiệu ứng tia sáng vương miện bừng nở rực rỡ ở VIỀN NGOÀI (giữ trọn độ nét của mặt)
    this.markers.forEach(m => {
      if (m === marker) {
        m.rimMesh.material.color.setHex(0xffffff);
        m.rimMesh.material.emissive = new THREE.Color(0xd4af37);
        m.rimMesh.material.emissiveIntensity = 1.0;
        m.coronaSprite.scale.set(5.2, 5.2, 1);
        m.coronaSprite.material.opacity = 1.0;
      } else {
        m.rimMesh.material.color.setHex(0xf3d68c);
        m.rimMesh.material.emissive = new THREE.Color(0x000000);
        m.rimMesh.material.emissiveIntensity = 0;
        m.coronaSprite.scale.set(m.baseHaloScale, m.baseHaloScale, 1);
        m.coronaSprite.material.opacity = 0.55;
      }
    });

    // Thông báo cho giao diện bên ngoài
    this.onSelectUser(marker.user);
  }

  /**
   * Reset lựa chọn và khôi phục trạng thái tương tác hoàn toàn
   */
  clearSelection() {
    this.selectedMarker = null;
    this.autoRotate = true;
    this.isDragging = false;
    this.dragMoved = false;
    this.rotationVelocity = { x: 0, y: 0.0015 };
    this.mouse.set(-999, -999);
    
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.style.cursor = 'grab';
    }

    this.markers.forEach(m => {
      m.rimMesh.material.color.setHex(0xf3d68c);
      m.rimMesh.material.emissive = new THREE.Color(0x000000);
      m.rimMesh.material.emissiveIntensity = 0;
      m.coronaSprite.scale.set(m.baseHaloScale, m.baseHaloScale, 1);
      m.coronaSprite.material.opacity = 0.85;
    });
  }

  onResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Vòng lặp Render & Animation
   */
  animate() {
    this.animationFrameId = requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    // 1. Quán tính & tự xoay mượt mà
    if (!this.isDragging) {
      if (this.autoRotate) {
        // Tự xoay chậm rãi, êm dịu quanh trục thẳng đứng
        this.globeGroup.rotation.y += 0.0012;
      } else {
        // Quán tính giảm tốc dần
        this.globeGroup.rotation.y += this.rotationVelocity.y;
        this.globeGroup.rotation.x = Math.max(-0.35, Math.min(0.35, this.globeGroup.rotation.x + this.rotationVelocity.x));

        this.rotationVelocity.x *= 0.94;
        this.rotationVelocity.y *= 0.94;

        if (Math.abs(this.rotationVelocity.x) < 0.0001 && Math.abs(this.rotationVelocity.y) < 0.0001) {
          if (!this.selectedMarker) {
            this.autoRotate = true;
          }
        }
      }
    }

    // 2. Chuyển động sao nền cực chậm tạo độ sâu
    if (this.starPoints) {
      this.starPoints.rotation.y = time * 0.0003;
    }

    // 3. Cập nhật độ hiển thị & Backface Culling cho từng Marker
    this.markers.forEach(m => {
      const isFront = this.isMarkerFrontFacing(m);
      const worldNormal = m.normal.clone().applyQuaternion(this.globeGroup.quaternion).normalize();
      const dot = worldNormal.dot(new THREE.Vector3(0, 0, 1));

      // Độ mờ giảm dần mượt mà khi xoay về phía sau mặt cầu
      let visibility = Math.max(0, Math.min(1, (dot - 0.05) / 0.25));

      m.group.visible = visibility > 0.02;
      m.avatarMesh.material.opacity = visibility;
      m.avatarMesh.material.transparent = true;
      m.rimMesh.material.opacity = visibility;
      m.rimMesh.material.transparent = true;

      // Hào quang tia sáng vương miện: xoay cực chậm và nhấp nháy thở sống động
      if (m.coronaSprite) {
        m.coronaSprite.material.rotation += (m.index % 2 === 0 ? 0.0012 : -0.0012);

        if (m !== this.selectedMarker) {
          const pulse = Math.sin(time * 2.2 + m.pulseOffset) * 0.12 + 0.88;
          m.coronaSprite.scale.set(m.baseHaloScale * pulse, m.baseHaloScale * pulse, 1);
          m.coronaSprite.material.opacity = 0.85 * visibility * pulse;
        }
      }
    });

    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    cancelAnimationFrame(this.animationFrameId);
    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    if (this.container.contains(dom)) {
      this.container.removeChild(dom);
    }
  }
}
