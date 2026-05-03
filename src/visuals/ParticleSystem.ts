import chroma from "chroma-js";
import {
    Points,
    BufferGeometry,
    BufferAttribute,
    ShaderMaterial,
    AdditiveBlending,
    Sprite,
    SpriteMaterial,
    CanvasTexture,
    Vector3,
    Texture,
} from "three";
import { STRIDE } from "../math/PhysicsEngine";

const energyColorScale = chroma.scale(["#ffcc44", "#ffffff", "#88ccff"]).mode("lch");
function buildEnergyLUT(steps: number): Float32Array {
    const arr = new Float32Array(steps * 3);
    for (let i = 0; i < steps; i++) {
        const [r, g, b] = energyColorScale(i / (steps - 1)).rgb();
        arr[i * 3] = r / 255;
        arr[i * 3 + 1] = g / 255;
        arr[i * 3 + 2] = b / 255;
    }
    return arr;
}
const ENERGY_COLOR_LUT = buildEnergyLUT(256);

function createStarSpriteTexture(): CanvasTexture {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, size, size);

    const cx = size / 2,
        cy = size / 2;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.05, "rgba(255,255,240,0.9)");
    gradient.addColorStop(0.2, "rgba(200,220,255,0.6)");
    gradient.addColorStop(0.5, "rgba(100,150,255,0.2)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    const spikeLen = size * 0.45;
    const spikeWidth = size * 0.03;
    for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(-spikeWidth, -spikeLen);
        ctx.lineTo(spikeWidth, -spikeLen);
        ctx.lineTo(0, -spikeLen * 0.2);
        ctx.closePath();
        const spikeGrad = ctx.createLinearGradient(0, -spikeLen * 0.2, 0, -spikeLen);
        spikeGrad.addColorStop(0, "rgba(255,255,255,0.5)");
        spikeGrad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = spikeGrad;
        ctx.fill();
    }
    ctx.restore();

    const tex = new CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

export class ParticleSystem {
    public points: Points;
    public bulgePoints: Points;
    public dustPoints: Points;
    public haloPoints: Points;
    public backgroundStars: Points | null = null;

    private geometry: BufferGeometry;
    private bulgeGeometry: BufferGeometry;
    private dustGeometry: BufferGeometry;
    private haloGeometry: BufferGeometry;
    private backgroundGeometry: BufferGeometry;

    private count: number;
    private bulgeCount: number;
    private dustCount: number;
    private haloCount: number;

    private positionArray: Float32Array;
    private colorArray: Float32Array;
    private sizeSeedArray: Float32Array;

    private bulgePositionArray: Float32Array;
    private bulgeColorArray: Float32Array;
    private dustPositionArray: Float32Array;
    private dustColorArray: Float32Array;
    private haloPositionArray: Float32Array;
    private haloColorArray: Float32Array;

    public blackHoleSprite: Sprite | null = null;

    private speeds: Float32Array;
    private lastPointSize = 1.8;
    private time = 0;

    private bulgeMap: Uint32Array;
    private dustMap: Uint32Array;
    private haloMap: Uint32Array;

    private accretionScale = chroma
        .scale(["white", "yellow", "orange", "red", "darkred", "black"])
        .mode("lch");

    private staticLayersInitialized = false;
    private spriteTexture: CanvasTexture;

    constructor(count: number) {
        this.count = count;
        this.bulgeCount = Math.floor(count * 0.12);
        this.dustCount = Math.floor(count * 0.18);
        this.haloCount = count * 2;

        this.bulgeMap = new Uint32Array(this.bulgeCount);
        this.dustMap = new Uint32Array(this.dustCount);
        this.haloMap = new Uint32Array(this.haloCount);
        for (let i = 0; i < this.bulgeCount; i++)
            this.bulgeMap[i] = Math.floor(Math.random() * count);
        for (let i = 0; i < this.dustCount; i++)
            this.dustMap[i] = Math.floor(Math.random() * count);
        for (let i = 0; i < this.haloCount; i++)
            this.haloMap[i] = Math.floor(Math.random() * count);

        this.spriteTexture = createStarSpriteTexture();

        this.geometry = new BufferGeometry();
        this.bulgeGeometry = new BufferGeometry();
        this.dustGeometry = new BufferGeometry();
        this.haloGeometry = new BufferGeometry();
        this.backgroundGeometry = new BufferGeometry();

        this.positionArray = new Float32Array(count * 3);
        this.colorArray = new Float32Array(count * 3);
        this.sizeSeedArray = new Float32Array(count);
        for (let i = 0; i < count; i++) this.sizeSeedArray[i] = Math.random();

        this.bulgePositionArray = new Float32Array(this.bulgeCount * 3);
        this.bulgeColorArray = new Float32Array(this.bulgeCount * 3);
        this.dustPositionArray = new Float32Array(this.dustCount * 3);
        this.dustColorArray = new Float32Array(this.dustCount * 3);
        this.haloPositionArray = new Float32Array(this.haloCount * 3);
        this.haloColorArray = new Float32Array(this.haloCount * 3);

        this.speeds = new Float32Array(count);

        this.geometry.setAttribute("position", new BufferAttribute(this.positionArray, 3));
        this.geometry.setAttribute("color", new BufferAttribute(this.colorArray, 3));
        this.geometry.setAttribute("sizeSeed", new BufferAttribute(this.sizeSeedArray, 1));

        this.bulgeGeometry.setAttribute(
            "position",
            new BufferAttribute(this.bulgePositionArray, 3),
        );
        this.bulgeGeometry.setAttribute("color", new BufferAttribute(this.bulgeColorArray, 3));
        this.dustGeometry.setAttribute("position", new BufferAttribute(this.dustPositionArray, 3));
        this.dustGeometry.setAttribute("color", new BufferAttribute(this.dustColorArray, 3));
        this.haloGeometry.setAttribute("position", new BufferAttribute(this.haloPositionArray, 3));
        this.haloGeometry.setAttribute("color", new BufferAttribute(this.haloColorArray, 3));

        const mainMaterial = this.createPointMaterial(this.spriteTexture);
        const bulgeMaterial = this.createPointMaterial(this.spriteTexture);
        const dustMaterial = this.createPointMaterial(this.spriteTexture);
        const haloMaterial = this.createPointMaterial(this.spriteTexture);

        bulgeMaterial.uniforms.pointSize.value = 3.2;
        bulgeMaterial.uniforms.alphaMultiplier.value = 1.3;
        dustMaterial.uniforms.pointSize.value = 3.0;
        dustMaterial.uniforms.alphaMultiplier.value = 0.85;
        haloMaterial.uniforms.pointSize.value = 1.1;
        haloMaterial.uniforms.alphaMultiplier.value = 0.28;

        this.points = new Points(this.geometry, mainMaterial);
        this.bulgePoints = new Points(this.bulgeGeometry, bulgeMaterial);
        this.dustPoints = new Points(this.dustGeometry, dustMaterial);
        this.haloPoints = new Points(this.haloGeometry, haloMaterial);

        this.createBlackHoleSprite();
        this.initializeStaticLayers();
        this.createBackgroundStars();
    }

    private createPointMaterial(spriteTex: Texture): ShaderMaterial {
        return new ShaderMaterial({
            uniforms: {
                pointSize: { value: 1.8 },
                time: { value: 0 },
                spriteTex: { value: spriteTex },
                alphaMultiplier: { value: 1.0 },
            },
            vertexShader: `
        attribute vec3 color;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float pointSize;
        uniform float time;
        uniform float alphaMultiplier;
        void main() {
          float twinkle = 0.85 + 0.3 * sin(time);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(1.5, pointSize * (400.0 / -mvPosition.z) * twinkle);
          gl_Position = projectionMatrix * mvPosition;
          vColor = color;
          vAlpha = alphaMultiplier;
        }
      `,
            fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        uniform sampler2D spriteTex;
        void main() {
          vec4 texColor = texture2D(spriteTex, gl_PointCoord);
          float alpha = texColor.a * vAlpha;
          gl_FragColor = vec4(vColor * texColor.rgb, alpha);
        }
      `,
            transparent: true,
            blending: AdditiveBlending,
            depthWrite: false,
        });
    }

    private createBackgroundStars() {
        const starCount = 4000;
        const radius = 800;
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = radius * (0.7 + Math.random() * 0.3);
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);
            colors[i * 3] = 1;
            colors[i * 3 + 1] = 0.9 + Math.random() * 0.1;
            colors[i * 3 + 2] = 0.8 + Math.random() * 0.2;
        }
        this.backgroundGeometry.setAttribute("position", new BufferAttribute(positions, 3));
        this.backgroundGeometry.setAttribute("color", new BufferAttribute(colors, 3));
        const mat = new ShaderMaterial({
            uniforms: { pointSize: { value: 0.6 }, spriteTex: { value: this.spriteTexture } },
            vertexShader: `
        attribute vec3 color;
        varying vec3 vColor;
        uniform float pointSize;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(1.5, pointSize * (300.0 / -mvPosition.z));
          gl_Position = projectionMatrix * mvPosition;
          vColor = color;
        }
      `,
            fragmentShader: `
        varying vec3 vColor;
        uniform sampler2D spriteTex;
        void main() {
          vec4 tex = texture2D(spriteTex, gl_PointCoord);
          gl_FragColor = vec4(vColor * tex.rgb, tex.a * 0.8);
        }
      `,
            transparent: true,
            blending: AdditiveBlending,
            depthWrite: false,
        });
        this.backgroundStars = new Points(this.backgroundGeometry, mat);
    }

    private createBlackHoleSprite() {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        const cx = size / 2,
            cy = size / 2;
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, size, size);

        const imageData = ctx.createImageData(size, size);
        const data = imageData.data;
        const voidRad = 16,
            innerRad = 20,
            outerRad = 48;
        for (let py = 0; py < size; py++) {
            for (let px = 0; px < size; px++) {
                const dx = px - cx,
                    dy = py - cy;
                const r = Math.sqrt(dx * dx + dy * dy);
                if (r < voidRad || r > outerRad + 6) continue;
                const t = Math.max(0, Math.min(1, (r - innerRad) / (outerRad - innerRad)));
                let intensity = 0;
                if (r >= innerRad && r <= outerRad) {
                    intensity = Math.sin(t * Math.PI) * 1.0;
                } else if (r > voidRad && r < innerRad) {
                    intensity = Math.pow((r - voidRad) / (innerRad - voidRad), 1.5) * 0.5;
                } else if (r > outerRad) {
                    intensity = (1 - (r - outerRad) / 7) * 0.4;
                }
                if (intensity <= 0.01) continue;
                const vBias = 0.6 + 0.5 * (dy / r);
                intensity *= Math.max(0.3, Math.min(1.3, vBias));
                intensity *= 0.9 + 0.2 * (dx / r);
                const colourFactor = Math.max(0, Math.min(1, (dy / r) * 0.7 + 0.5));
                const [R, G, B] = this.accretionScale(colourFactor).rgb();
                const alpha = Math.floor(intensity * 220);
                const idx = (py * size + px) * 4;
                data[idx] = R;
                data[idx + 1] = G;
                data[idx + 2] = B;
                data[idx + 3] = alpha;
            }
        }
        ctx.putImageData(imageData, 0, 0);

        const glow = ctx.createRadialGradient(cx, cy, innerRad, cx, cy, outerRad + 14);
        glow.addColorStop(0, "rgba(255,140,40,0.25)");
        glow.addColorStop(1, "rgba(80,30,10,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, outerRad + 14, 0, Math.PI * 2);
        ctx.fill();

        const tex = new CanvasTexture(canvas);
        const material = new SpriteMaterial({
            map: tex,
            blending: AdditiveBlending,
            depthWrite: false,
            color: 0xffffff,
            transparent: true,
        });
        this.blackHoleSprite = new Sprite(material);
        this.blackHoleSprite.scale.set(60, 60, 1);
        this.blackHoleSprite.visible = false;
    }

    private initializeStaticLayers() {
        if (this.staticLayersInitialized) return;
        this.staticLayersInitialized = true;

        const bulgePos = this.bulgeGeometry.attributes.position.array as Float32Array;
        const bulgeCol = this.bulgeGeometry.attributes.color.array as Float32Array;
        const dustPos = this.dustGeometry.attributes.position.array as Float32Array;
        const dustCol = this.dustGeometry.attributes.color.array as Float32Array;
        const haloPos = this.haloGeometry.attributes.position.array as Float32Array;
        const haloCol = this.haloGeometry.attributes.color.array as Float32Array;

        const bulgeColorScale = chroma.scale(["#fff5cc", "#ffcc66", "#ff9933"]).mode("lch");
        const dustColorScale = chroma.scale(["#996644", "#664422", "#332211"]).mode("lab");
        const haloColorScale = chroma.scale(["#cce0ff", "#88aaff"]).mode("lab");

        for (let i = 0; i < this.bulgeCount; i++) {
            const r = Math.pow(Math.random(), 1.6) * 65;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            bulgePos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            bulgePos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.7;
            bulgePos[i * 3 + 2] = r * Math.cos(phi) * 0.7;
            const [R, G, B] = bulgeColorScale(r / 65).rgb();
            bulgeCol[i * 3] = R / 255;
            bulgeCol[i * 3 + 1] = G / 255;
            bulgeCol[i * 3 + 2] = B / 255;
        }
        for (let i = 0; i < this.dustCount; i++) {
            const r = 40 + Math.pow(Math.random(), 2) * 240;
            const theta = Math.random() * Math.PI * 2;
            dustPos[i * 3] = r * Math.cos(theta);
            dustPos[i * 3 + 1] = (Math.random() - 0.5) * 28;
            dustPos[i * 3 + 2] = r * Math.sin(theta) * 0.35;
            const [R, G, B] = dustColorScale(0.3 + 0.7 * Math.random()).rgb();
            dustCol[i * 3] = R / 255;
            dustCol[i * 3 + 1] = G / 255;
            dustCol[i * 3 + 2] = B / 255;
        }
        for (let i = 0; i < this.haloCount; i++) {
            const r = 180 + Math.pow(Math.random(), 2.8) * 480;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            haloPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            haloPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.25;
            haloPos[i * 3 + 2] = r * Math.cos(phi) * 0.25;
            const [R, G, B] = haloColorScale(Math.random()).rgb();
            haloCol[i * 3] = R / 255;
            haloCol[i * 3 + 1] = G / 255;
            haloCol[i * 3 + 2] = B / 255;
        }

        this.bulgeGeometry.attributes.position.needsUpdate = true;
        this.bulgeGeometry.attributes.color.needsUpdate = true;
        this.dustGeometry.attributes.position.needsUpdate = true;
        this.dustGeometry.attributes.color.needsUpdate = true;
        this.haloGeometry.attributes.position.needsUpdate = true;
        this.haloGeometry.attributes.color.needsUpdate = true;
    }

    public update(data: Float32Array, pointSize: number, blackHoleIdx: number, deltaTime = 0.016) {
        this.time += deltaTime;

        const mainMat = this.points.material as ShaderMaterial;
        mainMat.uniforms.pointSize.value = pointSize;
        mainMat.uniforms.time.value = this.time;
        (this.bulgePoints.material as ShaderMaterial).uniforms.pointSize.value = pointSize * 1.8;
        (this.bulgePoints.material as ShaderMaterial).uniforms.time.value = this.time;
        (this.dustPoints.material as ShaderMaterial).uniforms.pointSize.value = pointSize * 1.5;
        (this.dustPoints.material as ShaderMaterial).uniforms.time.value = this.time;
        (this.haloPoints.material as ShaderMaterial).uniforms.pointSize.value = pointSize * 0.7;
        (this.haloPoints.material as ShaderMaterial).uniforms.time.value = this.time;

        if (this.blackHoleSprite && this.blackHoleSprite.visible) {
            const mat = this.blackHoleSprite.material as SpriteMaterial;
            mat.rotation += deltaTime * 0.3;
            mat.opacity = 0.8 + 0.4 * Math.sin(this.time * 7) * Math.sin(this.time * 5.3);
        }

        let maxEnergy = 0.1;
        for (let i = 0; i < this.count; i++) {
            const base = i * STRIDE;
            const vx = data[base + 3],
                vy = data[base + 4],
                vz = data[base + 5];
            const speedSq = vx * vx + vy * vy + vz * vz;
            this.speeds[i] = speedSq;
            if (speedSq > maxEnergy) maxEnergy = speedSq;
        }
        maxEnergy = Math.max(maxEnergy, 0.0001);
        const invMaxEnergy = 1 / maxEnergy;

        const lut = ENERGY_COLOR_LUT;
        const lutSteps = lut.length / 3;

        for (let i = 0; i < this.count; i++) {
            const base = i * STRIDE;
            const posIdx = i * 3;
            const x = data[base],
                y = data[base + 1],
                z = data[base + 2];
            this.positionArray[posIdx] = x;
            this.positionArray[posIdx + 1] = y;
            this.positionArray[posIdx + 2] = z;

            if (i === 0 || (i === blackHoleIdx && data[base + 6] > 50000)) {
                this.colorArray[posIdx] = 0;
                this.colorArray[posIdx + 1] = 0;
                this.colorArray[posIdx + 2] = 0;
                continue;
            }

            const energyFactor = Math.min(this.speeds[i] * invMaxEnergy, 1.0);
            const lutIdx = Math.min(Math.floor(energyFactor * (lutSteps - 1)), lutSteps - 1);
            const R = lut[lutIdx * 3];
            const G = lut[lutIdx * 3 + 1];
            const B = lut[lutIdx * 3 + 2];

            const dist = Math.sqrt(x * x + y * y + z * z) / 400;
            const angle = Math.atan2(y, x);
            const angle01 = (angle + Math.PI) / (Math.PI * 2);
            const pitch = 0.85;
            const logSpiral = Math.log(Math.max(dist, 0.01)) * pitch;
            const armPhase = (angle01 * 2 + logSpiral) % 1;
            const armIntensity = 0.5 + 0.5 * Math.sin(armPhase * Math.PI * 2);

            const dustPhase = (angle01 * 2 + logSpiral + 0.5) % 1;
            const dustDarken = Math.max(0, Math.min(1, -Math.sin(dustPhase * Math.PI * 2) * 0.5));

            let brightness =
                1.0 +
                armIntensity * 0.6 * Math.min(1, dist * 2.5) -
                dustDarken * 0.4 +
                energyFactor * 0.1;

            const vx = data[base + 3],
                vy = data[base + 4],
                vz = data[base + 5];
            const spd = Math.sqrt(vx * vx + vy * vy + vz * vz);
            if (spd > 0) {
                const nz = vz / spd;
                const dopplerFactor = 1.0 + nz * 0.1;
                brightness *= dopplerFactor;
            }

            this.colorArray[posIdx] = Math.min(R * brightness, 1.8);
            this.colorArray[posIdx + 1] = Math.min(G * brightness, 1.8);
            this.colorArray[posIdx + 2] = Math.min(B * brightness, 1.8);
        }

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;

        for (let i = 0; i < this.bulgeCount; i++) {
            const src = this.bulgeMap[i] * 3;
            const dst = i * 3;
            this.bulgePositionArray[dst] = this.positionArray[src];
            this.bulgePositionArray[dst + 1] = this.positionArray[src + 1];
            this.bulgePositionArray[dst + 2] = this.positionArray[src + 2];
        }
        this.bulgeGeometry.attributes.position.needsUpdate = true;

        for (let i = 0; i < this.dustCount; i++) {
            const src = this.dustMap[i] * 3;
            const dst = i * 3;
            this.dustPositionArray[dst] = this.positionArray[src];
            this.dustPositionArray[dst + 1] = this.positionArray[src + 1];
            this.dustPositionArray[dst + 2] = this.positionArray[src + 2];
        }
        this.dustGeometry.attributes.position.needsUpdate = true;

        for (let i = 0; i < this.haloCount; i++) {
            const src = this.haloMap[i] * 3;
            const dst = i * 3;
            this.haloPositionArray[dst] = this.positionArray[src];
            this.haloPositionArray[dst + 1] = this.positionArray[src + 1];
            this.haloPositionArray[dst + 2] = this.positionArray[src + 2];
        }
        this.haloGeometry.attributes.position.needsUpdate = true;

        this.updateBlackHoleSprite(data, pointSize, blackHoleIdx);
    }

    private updateBlackHoleSprite(data: Float32Array, pointSize: number, blackHoleIdx: number) {
        if (!this.blackHoleSprite) return;
        if (blackHoleIdx < 0 || blackHoleIdx >= this.count) {
            this.blackHoleSprite.visible = false;
            return;
        }
        const base = blackHoleIdx * STRIDE;
        if (data[base + 6] > 50000) {
            this.blackHoleSprite.position.set(data[base], data[base + 1], data[base + 2]);
            this.blackHoleSprite.visible = true;
            const scale = pointSize * 12.0;
            this.blackHoleSprite.scale.set(scale, scale, 1);
        } else {
            this.blackHoleSprite.visible = false;
        }
    }

    public getBlackHoleWorldPos(): Vector3 | null {
        if (!this.blackHoleSprite || !this.blackHoleSprite.visible) return null;
        return this.blackHoleSprite.position.clone();
    }

    public dispose() {
        this.geometry.dispose();
        this.bulgeGeometry.dispose();
        this.dustGeometry.dispose();
        this.haloGeometry.dispose();
        this.backgroundGeometry.dispose();
        (this.points.material as ShaderMaterial).dispose();
        (this.bulgePoints.material as ShaderMaterial).dispose();
        (this.dustPoints.material as ShaderMaterial).dispose();
        (this.haloPoints.material as ShaderMaterial).dispose();
        if (this.backgroundStars) (this.backgroundStars.material as ShaderMaterial).dispose();
        if (this.blackHoleSprite) (this.blackHoleSprite.material as SpriteMaterial).dispose();
    }
}
