import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export class SceneRenderer {
    public scene: THREE.Scene
    public camera: THREE.PerspectiveCamera
    public renderer: THREE.WebGLRenderer
    public controls: OrbitControls

    constructor() {
        this.scene = new THREE.Scene()
        this.scene.background = new THREE.Color(0x050510)

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000)
        this.camera.position.set(0, 300, 800)
        this.camera.lookAt(0, 0, 0)

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        document.body.appendChild(this.renderer.domElement)

        this.controls = new OrbitControls(this.camera, this.renderer.domElement)
        this.controls.enableDamping = true
        this.controls.dampingFactor = 0.05
        this.controls.autoRotate = true
        this.controls.autoRotateSpeed = 0.8
        this.controls.enableZoom = true
        this.controls.enablePan = true
        this.controls.target.set(0, 0, 0)

        const ambient = new THREE.AmbientLight(0x404060)
        this.scene.add(ambient)
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.2)
        dirLight.position.set(1, 1, 1)
        this.scene.add(dirLight)
    }

    public onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight
        this.camera.updateProjectionMatrix()
        this.renderer.setSize(window.innerWidth, window.innerHeight)
    }
}