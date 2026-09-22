<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as THREE from 'three'

const props = defineProps<{
  data: any
  style: any
  props: any
}>()

const container = ref<HTMLElement>()
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let globe: THREE.Mesh
let atmosphere: THREE.Mesh
let animationId: number
let markers: THREE.Group
let rotationSpeed = 0.002
let resizeObserver: ResizeObserver

// Simplified continent outlines (lat, lng pairs) for procedural texture
const continents = [
  // North America
  [[70,-165],[72,-55],[60,-60],[50,-55],[45,-65],[30,-80],[25,-80],[25,-100],[30,-115],[35,-120],[40,-125],[48,-125],[55,-130],[60,-140],[65,-168],[70,-165]],
  // South America
  [[12,-70],[10,-60],[5,-50],[0,-50],[-5,-35],[-15,-40],[-25,-45],[-35,-55],[-45,-65],[-55,-70],[-50,-75],[-40,-70],[-30,-70],[-20,-65],[-10,-75],[0,-80],[5,-77],[12,-70]],
  // Europe
  [[70,30],[60,30],[55,20],[50,15],[45,10],[40,0],[35,-5],[36,-10],[40,-10],[45,-5],[50,5],[55,10],[60,25],[70,30]],
  // Africa
  [[35,-10],[30,0],[25,10],[20,15],[15,20],[10,40],[5,42],[0,42],[-5,40],[-10,40],[-15,35],[-20,35],[-25,30],[-30,28],[-35,20],[-30,18],[-20,12],[-10,12],[0,10],[5,0],[10,-5],[15,-15],[20,-15],[25,-15],[30,-10],[35,-10]],
  // Asia
  [[70,30],[70,180],[65,170],[60,160],[55,140],[50,130],[45,135],[40,130],[35,130],[30,120],[25,105],[20,100],[15,100],[10,105],[5,105],[0,105],[0,80],[5,75],[10,75],[15,75],[20,72],[25,68],[30,60],[35,55],[40,45],[45,40],[50,40],[55,40],[60,40],[65,40],[70,30]],
  // Australia
  [[-15,130],[-20,118],[-25,115],[-30,115],[-35,118],[-38,145],[-35,150],[-30,153],[-25,152],[-20,148],[-15,145],[-12,142],[-15,130]],
]

function createEarthTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = 1024
  const ctx = canvas.getContext('2d')!

  // Ocean gradient
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, canvas.height)
  oceanGrad.addColorStop(0, '#0a1628')
  oceanGrad.addColorStop(0.3, '#0d2847')
  oceanGrad.addColorStop(0.5, '#0f3060')
  oceanGrad.addColorStop(0.7, '#0d2847')
  oceanGrad.addColorStop(1, '#0a1628')
  ctx.fillStyle = oceanGrad
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Grid lines (latitude/longitude)
  ctx.strokeStyle = 'rgba(0, 120, 200, 0.12)'
  ctx.lineWidth = 1

  // Latitude lines
  for (let lat = -80; lat <= 80; lat += 20) {
    const y = (90 - lat) / 180 * canvas.height
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(canvas.width, y)
    ctx.stroke()
  }

  // Longitude lines
  for (let lng = -180; lng <= 180; lng += 30) {
    const x = (lng + 180) / 360 * canvas.width
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, canvas.height)
    ctx.stroke()
  }

  // Draw continents
  const latLngToXY = (lat: number, lng: number): [number, number] => {
    const x = (lng + 180) / 360 * canvas.width
    const y = (90 - lat) / 180 * canvas.height
    return [x, y]
  }

  // Land base color
  ctx.fillStyle = 'rgba(20, 60, 40, 0.8)'
  continents.forEach(continent => {
    ctx.beginPath()
    continent.forEach(([lat, lng], i) => {
      const [x, y] = latLngToXY(lat, lng)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.fill()
  })

  // Land border glow
  ctx.strokeStyle = 'rgba(0, 200, 255, 0.35)'
  ctx.lineWidth = 2
  continents.forEach(continent => {
    ctx.beginPath()
    continent.forEach(([lat, lng], i) => {
      const [x, y] = latLngToXY(lat, lng)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.stroke()
  })

  // City dots with glow
  const cities = [
    { lat: 39.9, lng: 116.4, name: 'Beijing' },
    { lat: 31.2, lng: 121.5, name: 'Shanghai' },
    { lat: 23.1, lng: 113.3, name: 'Guangzhou' },
    { lat: 22.3, lng: 114.2, name: 'Hong Kong' },
    { lat: 35.7, lng: 139.7, name: 'Tokyo' },
    { lat: 37.6, lng: -122.4, name: 'San Francisco' },
    { lat: 51.5, lng: -0.1, name: 'London' },
    { lat: 48.9, lng: 2.35, name: 'Paris' },
    { lat: -33.9, lng: 151.2, name: 'Sydney' },
    { lat: 55.8, lng: 37.6, name: 'Moscow' },
    { lat: 1.3, lng: 103.8, name: 'Singapore' },
    { lat: 25.2, lng: 55.3, name: 'Dubai' },
    { lat: 19.1, lng: 72.9, name: 'Mumbai' },
    { lat: 40.7, lng: -74, name: 'New York' },
    { lat: 52.5, lng: 13.4, name: 'Berlin' },
  ]

  cities.forEach(city => {
    const [x, y] = latLngToXY(city.lat, city.lng)
    // Glow
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 12)
    glow.addColorStop(0, 'rgba(0, 200, 255, 0.8)')
    glow.addColorStop(0.5, 'rgba(0, 200, 255, 0.2)')
    glow.addColorStop(1, 'rgba(0, 200, 255, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(x, y, 12, 0, Math.PI * 2)
    ctx.fill()
    // Dot
    ctx.fillStyle = '#00e5ff'
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, Math.PI * 2)
    ctx.fill()
  })

  // Add some connection lines between major cities
  const connections = [
    [0, 1], [0, 4], [0, 13], [1, 8], [4, 14],
    [6, 7], [6, 9], [10, 11], [12, 10], [13, 6]
  ]

  ctx.strokeStyle = 'rgba(0, 180, 255, 0.15)'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  connections.forEach(([i, j]) => {
    const city1 = cities[i]
    const city2 = cities[j]
    const [x1, y1] = latLngToXY(city1.lat, city1.lng)
    const [x2, y2] = latLngToXY(city2.lat, city2.lng)
    ctx.beginPath()
    // Curved line
    const cx = (x1 + x2) / 2
    const cy = Math.min(y1, y2) - 30
    ctx.moveTo(x1, y1)
    ctx.quadraticCurveTo(cx, cy, x2, y2)
    ctx.stroke()
  })
  ctx.setLineDash([])

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

const init = () => {
  if (!container.value) return

  const width = container.value.clientWidth
  const height = container.value.clientHeight

  // Scene
  scene = new THREE.Scene()

  // Camera
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
  camera.position.z = 3

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)
  container.value.appendChild(renderer.domElement)

  // Globe with earth texture
  const earthTexture = createEarthTexture()
  const globeGeometry = new THREE.SphereGeometry(1, 64, 64)
  const globeMaterial = new THREE.MeshPhongMaterial({
    map: earthTexture,
    emissive: 0x050a15,
    emissiveIntensity: 0.3,
    specular: 0x4488cc,
    shininess: 15,
  })
  globe = new THREE.Mesh(globeGeometry, globeMaterial)
  scene.add(globe)

  // Atmosphere glow
  const atmosphereGeometry = new THREE.SphereGeometry(1.12, 64, 64)
  const atmosphereMaterial = new THREE.ShaderMaterial({
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
        float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.5);
        gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity * 0.8;
      }
    `,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true
  })
  atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial)
  scene.add(atmosphere)

  // Markers group
  markers = new THREE.Group()
  globe.add(markers)

  // Add default markers
  addDefaultMarkers()

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x334466, 0.6)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2)
  directionalLight.position.set(5, 3, 5)
  scene.add(directionalLight)

  const backLight = new THREE.DirectionalLight(0x4488cc, 0.3)
  backLight.position.set(-5, -3, -5)
  scene.add(backLight)

  // Start animation
  animate()
}

const addDefaultMarkers = () => {
  while (markers.children.length > 0) {
    markers.remove(markers.children[0])
  }

  const markerPositions = [
    { lat: 39.9, lng: 116.4, color: 0x00ff88, size: 0.018 },
    { lat: 31.2, lng: 121.5, color: 0x00aaff, size: 0.018 },
    { lat: 23.1, lng: 113.3, color: 0xffaa00, size: 0.015 },
    { lat: 22.3, lng: 114.2, color: 0xff5555, size: 0.015 },
    { lat: 35.7, lng: 139.7, color: 0x00ffaa, size: 0.015 },
    { lat: 37.6, lng: -122.4, color: 0xff00ff, size: 0.012 },
    { lat: 51.5, lng: -0.1, color: 0xffff00, size: 0.012 },
    { lat: 48.9, lng: 2.35, color: 0x00ffff, size: 0.012 },
    { lat: 40.7, lng: -74, color: 0xff8844, size: 0.012 },
    { lat: -33.9, lng: 151.2, color: 0x88ff44, size: 0.01 },
    { lat: 55.8, lng: 37.6, color: 0x4488ff, size: 0.01 },
    { lat: 25.2, lng: 55.3, color: 0xff4488, size: 0.01 },
  ]

  markerPositions.forEach(pos => {
    const phi = (90 - pos.lat) * (Math.PI / 180)
    const theta = (pos.lng + 180) * (Math.PI / 180)

    const x = -1.02 * Math.sin(phi) * Math.cos(theta)
    const y = 1.02 * Math.cos(phi)
    const z = 1.02 * Math.sin(phi) * Math.sin(theta)

    // Marker point
    const markerGeometry = new THREE.SphereGeometry(pos.size, 12, 12)
    const markerMaterial = new THREE.MeshBasicMaterial({ color: pos.color })
    const marker = new THREE.Mesh(markerGeometry, markerMaterial)
    marker.position.set(x, y, z)
    markers.add(marker)

    // Glow ring
    const ringGeometry = new THREE.RingGeometry(pos.size * 1.8, pos.size * 2.2, 24)
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: pos.color,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    })
    const ring = new THREE.Mesh(ringGeometry, ringMaterial)
    ring.position.set(x, y, z)
    ring.lookAt(new THREE.Vector3(0, 0, 0))
    markers.add(ring)
  })
}

const animate = () => {
  animationId = requestAnimationFrame(animate)
  if (globe) globe.rotation.y += rotationSpeed
  if (renderer && scene && camera) renderer.render(scene, camera)
}

const handleResize = () => {
  if (!container.value || !camera || !renderer) return
  const width = container.value.clientWidth
  const height = container.value.clientHeight
  if (width === 0 || height === 0) return
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

watch(() => props.props?.rotationSpeed, (val) => {
  rotationSpeed = (val ?? 2) / 1000
})

onMounted(() => {
  init()
  // Watch container size changes
  if (container.value) {
    resizeObserver = new ResizeObserver(() => handleResize())
    resizeObserver.observe(container.value)
  }
})

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect()
  if (animationId) cancelAnimationFrame(animationId)
  if (renderer) {
    renderer.dispose()
    if (container.value && renderer.domElement.parentNode === container.value) {
      container.value.removeChild(renderer.domElement)
    }
  }
  if (scene) {
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => {
            if (m instanceof THREE.MeshPhongMaterial && m.map) m.map.dispose()
            m.dispose()
          })
        } else {
          if (obj.material instanceof THREE.MeshPhongMaterial && obj.material.map) obj.material.map.dispose()
          obj.material.dispose()
        }
      }
    })
  }
})
</script>

<template>
  <div ref="container" class="globe-3d"></div>
</template>

<style scoped>
.globe-3d {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
