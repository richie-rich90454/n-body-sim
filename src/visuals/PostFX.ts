import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { WebGLRenderer, Scene, PerspectiveCamera, Vector2 } from 'three'

export class PostFX {
    public composer: EffectComposer
    public bloomPass: UnrealBloomPass

    constructor(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera) {
        this.composer = new EffectComposer(renderer)
        this.composer.addPass(new RenderPass(scene, camera))

        this.bloomPass = new UnrealBloomPass(new Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85)
        this.bloomPass.threshold = 0.1
        this.bloomPass.strength = 1.2
        this.bloomPass.radius = 0.8

        this.composer.addPass(this.bloomPass)
    }

    public setBloomIntensity(value: number) {
        this.bloomPass.strength = value
    }

    public setSize(width: number, height: number) {
        this.composer.setSize(width, height)
    }

    public render() {
        this.composer.render()
    }
}