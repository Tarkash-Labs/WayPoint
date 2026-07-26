import { useState, useMemo, useRef, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Edges, MeshReflectorMaterial, Line, Html, Grid } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import * as THREE from 'three'
import { treemap, hierarchy, treemapSquarify } from 'd3-hierarchy'
import ErrorBoundary from '../components/ErrorBoundary'

/* ── Constants & Theme ─────────────────────────────────
   Dusk-skyline redesign: risk tiers now map to believable window-light
   colors (alarm red / sodium amber / incandescent warm / fluorescent cool)
   instead of full-building neon emissive, so the risk signal survives as
   "what color are this building's windows" rather than "how much does it glow." */
const RISK_COLORS = {
  critical: { hex: '#ff4d4d', emissive: '#ff4d4d', intensity: 1.4 }, // alarm-red windows
  high: { hex: '#ffab4a', emissive: '#ffab4a', intensity: 1.1 },     // sodium amber
  medium: { hex: '#ffd98a', emissive: '#ffd98a', intensity: 0.85 },  // warm incandescent
  low: { hex: '#bfe6ff', emissive: '#bfe6ff', intensity: 0.6 },      // cool fluorescent
}

const MISSION_COLORS = {
  target: { hex: '#ffd166', emissive: '#ffd166', intensity: 2.0 }, // rooftop search beacon
  trap: { hex: '#ff3b30', emissive: '#ff3b30', intensity: 2.2 },   // hazard beacon
  dim: { hex: '#20242c', emissive: '#000000', intensity: 0.08 },
}

function getRiskTier(score) {
  if (score >= 8) return 'critical'
  if (score >= 6) return 'high'
  if (score >= 4) return 'medium'
  return 'low'
}

// Muted, awning/signage-toned district tints so each folder reads as its own
// real neighborhood rather than a saturated data-viz category color
const DISTRICT_PALETTE = ['#c9a24b', '#5b8a72', '#9c5b46', '#5a7ba6', '#8a6d9c', '#b0724f', '#6b9c8f', '#a67c52']
function getDistrictColor(name) {
  let s = 0
  for (let i = 0; i < name.length; i++) s += name.charCodeAt(i)
  return DISTRICT_PALETTE[s % DISTRICT_PALETTE.length]
}

/* ── Procedural Cyberpunk Building ────────────────────── */
function CyberBuilding({
  position, size, file,
  isHovered, isNeighborHovered,
  isMissionActive, isMissionTarget, isMissionTrap,
  onClick, onPointerOver, onPointerOut
}) {
  const groupRef = useRef()
  const meshRef = useRef()
  const w = size[0], h = size[1], d = size[2]

  // Architecture variations based on file hash/path
  const seed = useMemo(() => {
    let s = 0;
    for (let i = 0; i < file.path.length; i++) s += file.path.charCodeAt(i)
    return s
  }, [file.path])

  const archType = h < 7 ? 3 : seed % 3 // 0: Standard, 1: Tapered, 2: Stacked, 3: Low House (small/trivial files)
  const hasAntenna = seed % 5 === 0

  // State colors
  let colorTheme = RISK_COLORS[getRiskTier(file.riskScore || 1)]
  let targetEmissive = colorTheme.emissive
  let targetIntensity = colorTheme.intensity
  let targetOpacity = 1.0

  if (isMissionActive) {
    if (isMissionTarget) {
      targetEmissive = MISSION_COLORS.target.emissive
      targetIntensity = MISSION_COLORS.target.intensity
    } else if (isMissionTrap) {
      targetEmissive = MISSION_COLORS.trap.emissive
      targetIntensity = MISSION_COLORS.trap.intensity
    } else {
      targetEmissive = MISSION_COLORS.dim.emissive
      targetIntensity = MISSION_COLORS.dim.intensity
      targetOpacity = 0.3
    }
  } else if (isHovered) {
    targetIntensity *= 3.0
  } else if (isNeighborHovered) {
    targetIntensity *= 1.5
  }

  // Breathing animation
  const phase = useMemo(() => Math.random() * Math.PI * 2, [])
  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.getElapsedTime()
    // Idle breathing
    const breath = Math.sin(t * 2 + phase) * 0.015
    groupRef.current.scale.y = 1 + breath
  })

  // Shader inject for procedural windows
  const customMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: '#4d4f56', // concrete/glass facade, not a black neon shell
      roughness: 0.85,  // matte concrete reads as real material under dusk light
      metalness: 0.12,
      transparent: true,
      opacity: targetOpacity
    })

    mat.onBeforeCompile = (shader) => {
      // Pass file properties to shader
      shader.uniforms.uBaseGlow = { value: new THREE.Color(targetEmissive).multiplyScalar(targetIntensity) }
      shader.uniforms.uDensity = { value: Math.max(2.0, (file.riskScore || 1) * 1.5) }
      shader.uniforms.uActivity = { value: isHovered || isMissionTarget ? 1.0 : (isMissionActive && !isMissionTarget ? 0.0 : 0.4) }
      shader.uniforms.uTime = { value: 0 }

      mat.userData.shader = shader

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
         varying vec3 vWorldPos;`
      ).replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      )

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
         uniform vec3 uBaseGlow;
         uniform float uDensity;
         uniform float uActivity;
         uniform float uTime;
         varying vec3 vWorldPos;`
      ).replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         
         vec2 grid;
         vec3 n = abs(vNormal);
         if (n.x > 0.5) grid = vWorldPos.zy;
         else if (n.z > 0.5) grid = vWorldPos.xy;
         else grid = vWorldPos.xz;
         
         grid *= uDensity; 
         
         vec2 cell = floor(grid);
         vec2 uvF = fract(grid);
         
         float window = step(0.2, uvF.x) * step(0.2, uvF.y);
         if (n.y > 0.5) window = 0.0; // Roof has no windows
         
         // Randomizer
         float rnd = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
         
         // Inactive files have dark windows, active ones blink or stay lit
         float isLit = step(1.0 - uActivity, rnd);
         
         // Add some bloom-catching intensity
         totalEmissiveRadiance += uBaseGlow * window * isLit * 2.0;`
      )
    }
    return mat
  }, [targetEmissive, targetIntensity, targetOpacity, file.riskScore, isHovered, isMissionTarget, isMissionActive])

  // Update time for shader
  useFrame((state) => {
    if (customMaterial.userData.shader) {
      customMaterial.userData.shader.uniforms.uTime.value = state.clock.getElapsedTime()
      // Smoothly update emissive to prevent jumps
      customMaterial.userData.shader.uniforms.uBaseGlow.value.lerp(
        new THREE.Color(targetEmissive).multiplyScalar(targetIntensity),
        0.1
      )
    }
  })

  const edgeColor = new THREE.Color(targetEmissive).multiplyScalar(isHovered ? 2 : 0.5)

  return (
    <group
      ref={groupRef}
      position={position}
      onPointerOver={(e) => { e.stopPropagation(); onPointerOver() }}
      onPointerOut={onPointerOut}
      onClick={(e) => { e.stopPropagation(); onClick() }}
    >
      {/* Main Structure */}
      {archType === 1 ? (
        // Tapered Tower — two stacked boxes narrowing upward, reads as a real building silhouette
        <group>
          <mesh position={[0, h * 0.35, 0]} material={customMaterial}>
            <boxGeometry args={[w, h * 0.7, d]} />
            <Edges threshold={15} color={edgeColor} />
          </mesh>
          <mesh position={[0, h * 0.85, 0]} material={customMaterial}>
            <boxGeometry args={[w * 0.55, h * 0.3, d * 0.55]} />
            <Edges threshold={15} color={edgeColor} />
          </mesh>
        </group>
      ) : archType === 2 ? (
        // Stacked Blocks
        <group>
          <mesh position={[0, h * 0.3, 0]} material={customMaterial}>
            <boxGeometry args={[w, h * 0.6, d]} />
            <Edges threshold={15} color={edgeColor} />
          </mesh>
          <mesh position={[0, h * 0.8, 0]} material={customMaterial}>
            <boxGeometry args={[w * 0.7, h * 0.4, d * 0.7]} />
            <Edges threshold={15} color={edgeColor} />
          </mesh>
        </group>
      ) : archType === 3 ? (
        // Low House — small/trivial files render as compact structures with a roof ledge,
        // not scaled-down towers. This is what most of a real skyline actually looks like.
        <group>
          <mesh position={[0, h / 2, 0]} material={customMaterial}>
            <boxGeometry args={[w, h, d]} />
            <Edges threshold={15} color={edgeColor} />
          </mesh>
          <mesh position={[0, h + 0.15, 0]}>
            <boxGeometry args={[w * 1.08, 0.3, d * 1.08]} />
            <meshStandardMaterial color="#050508" roughness={0.6} metalness={0.4} />
          </mesh>
        </group>
      ) : (
        // Standard Block — plus a small rooftop mechanical unit, since real
        // flat-roofed towers are almost never a bare box
        <group>
          <mesh ref={meshRef} position={[0, h / 2, 0]} material={customMaterial}>
            <boxGeometry args={[w, h, d]} />
            <Edges threshold={15} color={edgeColor} />
          </mesh>
          <mesh position={[w * 0.22, h + 0.15, d * 0.2]}>
            <boxGeometry args={[Math.max(w * 0.22, 0.5), 0.3, Math.max(d * 0.18, 0.5)]} />
            <meshStandardMaterial color="#2a2b2f" roughness={0.7} metalness={0.2} />
          </mesh>
        </group>
      )}

      {/* Rooftop mast — dull antenna/utility mast with a small aviation warning light,
          the kind every real skyline has, rather than a colored energy beam */}
      {hasAntenna && (
        <group position={[0, h, 0]}>
          <mesh position={[0, 1, 0]}>
            <cylinderGeometry args={[0.02, 0.05, 2]} />
            <meshStandardMaterial color="#2a2b2f" roughness={0.6} metalness={0.5} />
          </mesh>
          <mesh position={[0, 2.05, 0]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshBasicMaterial color="#ff3b30" toneMapped={false} />
          </mesh>
        </group>
      )}

      {/* Hazard marker — a low warning beacon + thin barrier ring at street level,
          reading as a cordoned-off building rather than a glitching wireframe */}
      {isMissionTrap && (
        <group>
          <mesh position={[0, h + 0.3, 0]}>
            <sphereGeometry args={[0.15, 10, 10]} />
            <meshBasicMaterial color="#ff3b30" toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[Math.max(w, d) / 2 + 0.3, Math.max(w, d) / 2 + 0.6, 24]} />
            <meshBasicMaterial color="#ff3b30" transparent opacity={0.5} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        </group>
      )}

      {/* Hover Base Glow */}
      {isHovered && (
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(w, d) / 2 + 0.5, Math.max(w, d) / 2 + 1.5, 32]} />
          <meshBasicMaterial color={targetEmissive} transparent opacity={0.5} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

/* ── Urban Districts (Folders) ────────────────────────── */
function DistrictPlatform({ position, size, name, isDimmed, maxHeight = 4 }) {
  const w = size[0], d = size[2]
  const tint = useMemo(() => getDistrictColor(name), [name])
  const groupRef = useRef()
  const labelRef = useRef()
  const worldPos = useMemo(() => new THREE.Vector3(), [])

  useFrame((state) => {
    if (!groupRef.current || !labelRef.current) return
    groupRef.current.getWorldPosition(worldPos)
    worldPos.y = maxHeight
    const dist = state.camera.position.distanceTo(worldPos)
    // Full opacity up close, fading past ~55 units — keeps nearby labels crisp
    // while distant/overlapping ones recede instead of stacking on screen
    const opacity = Math.min(1, Math.max(0.12, 1 - (dist - 55) / 70))
    labelRef.current.style.opacity = opacity.toFixed(2)
  })

  return (
    <group ref={groupRef} position={position}>
      {/* Base platform — matte pavement block; district tint lives on the curb edge only,
          so folders read as distinct city blocks instead of glowing data plazas */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[w, 0.1, d]} />
        <meshStandardMaterial
          color="#3a3a3d"
          roughness={0.9}
          metalness={0.05}
          transparent
          opacity={isDimmed ? 0.3 : 1}
        />
        <Edges color={tint} />
      </mesh>
      {/* Neon border outline around district */}
      <Line
        points={[
          [-w/2, 0.12, -d/2], [w/2, 0.12, -d/2], [w/2, 0.12, d/2], [-w/2, 0.12, d/2], [-w/2, 0.12, -d/2]
        ]}
        color={tint}
        lineWidth={3}
        transparent
        opacity={isDimmed ? 0.05 : 0.6}
        toneMapped={false}
      />
      {/* District Label — reads like a street sign (solid tint background, clean type)
          floating above the tallest building in the district, fading with distance */}
      {!isDimmed && w > 4 && d > 4 && (
        <Html position={[0, maxHeight, 0]} center distanceFactor={45} style={{ pointerEvents: 'none' }}>
          <div ref={labelRef} style={{
            color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '12px', fontWeight: 600,
            letterSpacing: '0.5px', whiteSpace: 'nowrap',
            background: tint, boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
            padding: '4px 10px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.25)',
            transition: 'opacity 0.1s linear'
          }}>
            {name} District
          </div>
        </Html>
      )}
    </group>
  )
}

/* ── Hovercraft Traffic (Instanced) ───────────────────── */
function HovercraftTraffic({ count = 200, bounds }) {
  const meshRef = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const craft = useMemo(() => {
    return Array.from({ length: count }, () => {
      // Ground roads or sky traffic
      const isGround = Math.random() > 0.4
      const altitude = isGround ? 0.4 : Math.random() * 20 + 5
      const speed = (Math.random() * 15 + 10) * (isGround ? 1 : 1.5)
      // Axis aligned movement
      const axis = Math.random() > 0.5 ? 'x' : 'z'
      const dir = Math.random() > 0.5 ? 1 : -1

      // Real vehicle-color distribution — mostly neutral body colors with a
      // headlight-warm or taillight-red glow, so traffic reads as actual cars
      // rather than a swarm of uniform glowing data blocks
      const bodyColors = ['#e8e8e8', '#c9ccd1', '#2a2b2f', '#1c1d22', '#8a1f1f', '#2e4a6b']
      let color = isGround
        ? bodyColors[Math.floor(Math.random() * bodyColors.length)]
        : (dir > 0 ? '#ffcf8a' : '#ff4d4d') // sky traffic reads by heading: warm headlight vs red taillight

      return {
        pos: new THREE.Vector3(
          (Math.random() - 0.5) * bounds,
          altitude,
          (Math.random() - 0.5) * bounds
        ),
        axis,
        dir,
        speed,
        color: new THREE.Color(color).multiplyScalar(isGround ? 1 : 1.6),
        scale: isGround ? [0.6, 0.2, 0.6] : [0.4, 0.2, 0.4]
      }
    })
  }, [count, bounds])

  const colors = useMemo(() => {
    const arr = new Float32Array(count * 3)
    craft.forEach((c, i) => {
      c.color.toArray(arr, i * 3)
    })
    return arr
  }, [craft])

  useFrame((state, delta) => {
    if (!meshRef.current) return
    craft.forEach((c, i) => {
      // Move
      c.pos[c.axis] += c.dir * c.speed * delta
      // Wrap
      if (c.pos[c.axis] > bounds / 2) c.pos[c.axis] = -bounds / 2
      if (c.pos[c.axis] < -bounds / 2) c.pos[c.axis] = bounds / 2

      dummy.position.copy(c.pos)
      // Stretch based on velocity
      const sx = c.axis === 'x' ? c.scale[0] * 2 : c.scale[0]
      const sz = c.axis === 'z' ? c.scale[2] * 2 : c.scale[2]
      dummy.scale.set(sx, c.scale[1], sz)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <boxGeometry args={[1, 1, 1]}>
        <instancedBufferAttribute attach="attributes-color" args={[colors, 3]} />
      </boxGeometry>
      <meshBasicMaterial vertexColors toneMapped={false} />
    </instancedMesh>
  )
}

/* ── Dependency Bridges (Elevated) ────────────────────── */
function DependencyBridges({ buildings, isMissionActive, targetPaths }) {
  // Generate stable mock dependencies between random buildings
  const bridges = useMemo(() => {
    if (buildings.length < 2) return []
    const lines = []
    // Create ~15 bridges
    for (let i = 0; i < 15; i++) {
      const b1 = buildings[Math.floor(Math.random() * buildings.length)]
      const b2 = buildings[Math.floor(Math.random() * buildings.length)]
      if (b1 === b2) continue

      const isTarget = isMissionActive && targetPaths.includes(b1.file.path) && targetPaths.includes(b2.file.path)
      const color = isTarget ? '#ffd166' : '#7c94ad' // steel-cable tone, reads as real infrastructure not a data laser
      const opacity = isMissionActive && !isTarget ? 0.05 : 0.35

      // Calculate arc
      const p1 = new THREE.Vector3(...b1.position)
      p1.y = b1.size[1] * 0.8
      const p2 = new THREE.Vector3(...b2.position)
      p2.y = b2.size[1] * 0.8

      const dist = p1.distanceTo(p2)
      const mid = p1.clone().lerp(p2, 0.5)
      mid.y += dist * 0.2 // Arc height

      const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2)
      const points = curve.getPoints(20)

      lines.push({ points, color, opacity, isTarget })
    }
    return lines
  }, [buildings, isMissionActive, targetPaths])

  return (
    <group>
      {bridges.map((b, i) => (
        <Line
          key={i}
          points={b.points}
          color={b.color}
          lineWidth={b.isTarget ? 3 : 1}
          transparent
          opacity={b.opacity}
          toneMapped={false}
        />
      ))}
    </group>
  )
}

/* ── GPS Mission Route ────────────────────────────────── */
function GPSRoute({ buildings, targetPaths }) {
  const routePoints = useMemo(() => {
    if (!targetPaths || targetPaths.length < 2) return null
    // Order buildings by targetPaths sequence
    const ordered = targetPaths.map(p => buildings.find(b => b.file.path === p)).filter(Boolean)
    if (ordered.length < 2) return null

    const pts = []
    ordered.forEach((b, i) => {
      pts.push(new THREE.Vector3(b.position[0], 0.2, b.position[2]))
      // Add a slight arc between them
      if (i < ordered.length - 1) {
        const next = ordered[i + 1]
        const mid = new THREE.Vector3(
          (b.position[0] + next.position[0]) / 2,
          5, // fly over height
          (b.position[2] + next.position[2]) / 2
        )
        pts.push(mid)
      }
    })
    const curve = new THREE.CatmullRomCurve3(pts)
    return curve.getPoints(50)
  }, [buildings, targetPaths])

  if (!routePoints) return null

  return (
    <Line
      points={routePoints}
      color="#4c8dff"
      lineWidth={4}
      toneMapped={false}
    />
  )
}

/* ── Camera Controller (Cinematic Drift / Fly) ────────── */
function CameraController({ selectedBuilding, isMissionActive, gpsStartPoint }) {
  const { camera, controls } = useThree()

  const targetLook = useRef(new THREE.Vector3(0, 0, 0))
  const isTransitioning = useRef(false)

  // Trigger transition when selection changes
  useEffect(() => {
    if (selectedBuilding) {
      targetLook.current.set(...selectedBuilding.position)
      targetLook.current.y = selectedBuilding.size[1] / 2
      isTransitioning.current = true
    } else if (isMissionActive && gpsStartPoint) {
      targetLook.current.set(gpsStartPoint[0], 0, gpsStartPoint[2])
      isTransitioning.current = true
    } else {
      targetLook.current.set(0, 0, 0)
      isTransitioning.current = true
    }
  }, [selectedBuilding, isMissionActive, gpsStartPoint])

  useFrame((state, delta) => {
    if (!controls) return

    // Auto rotate if idle
    controls.autoRotate = !selectedBuilding && !isMissionActive
    controls.autoRotateSpeed = 0.5

    if (isTransitioning.current) {
      // Lerp controls target instead of forcing camera.lookAt
      controls.target.lerp(targetLook.current, 3 * delta)

      if (controls.target.distanceTo(targetLook.current) < 0.1) {
        isTransitioning.current = false
      }

      // Zoom in slightly when selecting a building
      if (selectedBuilding) {
        const targetPos = new THREE.Vector3(
          selectedBuilding.position[0] + selectedBuilding.size[0] + 25,
          selectedBuilding.size[1] + 15,
          selectedBuilding.position[2] + 30
        )
        camera.position.lerp(targetPos, 2 * delta)
      } else if (!isMissionActive) {
        // Slowly pull back to city view if returning to idle
        const dist = camera.position.length()
        if (dist < 60) {
          camera.position.lerp(camera.position.clone().normalize().multiplyScalar(80), delta)
        }
      }
    }
  })

  return null
}

/* ── Post-Processing & Atmosphere ─────────────────────── */
function CyberEffects() {
  return (
    <EffectComposer disableNormalPass multisampling={4}>
      <Bloom
        luminanceThreshold={0.85} // Only real point-lights (windows, beacons, headlights) bloom
        luminanceSmoothing={0.15}
        intensity={0.8}
        radius={0.5}
      />
      <Vignette offset={0.35} darkness={0.5} />
      <Noise opacity={0.015} />
    </EffectComposer>
  )
}

function AtmosphericParticles() {
  const count = 500
  const mesh = useRef()

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      pos: new THREE.Vector3((Math.random() - 0.5) * 150, Math.random() * 50, (Math.random() - 0.5) * 150),
      speed: Math.random() * 0.2 + 0.1
    }))
  }, [])

  useFrame((state, delta) => {
    particles.forEach((p, i) => {
      p.pos.y += p.speed * delta
      if (p.pos.y > 50) p.pos.y = 0
      dummy.position.copy(p.pos)
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[null, null, count]}>
      <planeGeometry args={[0.2, 0.2]} />
      <meshBasicMaterial color="#ffe9c7" transparent opacity={0.1} depthWrite={false} />
    </instancedMesh>
  )
}

/* ── Atmospheric Horizon (dusk gradient sky with a low sun) ──── */
function CityAtmosphere() {
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color('#12213f') },   // deep dusk blue overhead
      bottomColor: { value: new THREE.Color('#ff8a5c') }, // warm sunset band at the horizon
      offset: { value: 15 },
      exponent: { value: 0.7 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false, // keep the horizon glow clean instead of washed out by scene fog
  }), [])

  return (
    <group>
      <mesh material={material} renderOrder={-10}>
        <sphereGeometry args={[400, 24, 24]} />
      </mesh>
      {/* Low sun — the one warm light source everything else keys off */}
      <mesh position={[160, 42, -300]} renderOrder={-9}>
        <sphereGeometry args={[14, 24, 24]} />
        <meshBasicMaterial color="#ffe9c7" toneMapped={false} fog={false} />
      </mesh>
      <mesh position={[160, 42, -300]} renderOrder={-9}>
        <sphereGeometry args={[30, 24, 24]} />
        <meshBasicMaterial color="#ffb672" transparent opacity={0.25} toneMapped={false} fog={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ── Main City Scene ──────────────────────────────────── */
function CityScene({ data, selectedTask, onHoverInfo }) {
  const [hoveredFile, setHoveredFile] = useState(null)
  const [selectedBuilding, setSelectedBuilding] = useState(null)

  // Layout processing (stable unless data changes)
  const { buildings, districts, gridSize } = useMemo(() => {
    if (!data?.files?.length) return { buildings: [], districts: [], gridSize: 50 }

    const dirMap = {}
    data.files.forEach((file) => {
      const dir = file.directory || file.path?.split('/')[0] || 'root'
      if (!dirMap[dir]) dirMap[dir] = []
      dirMap[dir].push(file)
    })

    const size = Math.min(120, Math.max(60, Math.sqrt(data.files.length) * 7))
    const root = {
      name: 'root',
      children: Object.entries(dirMap).map(([dir, files]) => ({
        name: dir,
        children: files.map((f) => ({ name: f.path, value: Math.max(f.linesOfCode || 10, 10), file: f })),
      })),
    }

    const layout = treemap().size([size, size]).paddingInner(2.5).paddingOuter(12).tile(treemapSquarify)
    const rootNode = hierarchy(root).sum((d) => d.value)
    layout(rootNode)

    const buildingList = []
    const districtList = []

    rootNode.each((node) => {
      const w = node.x1 - node.x0
      const d = node.y1 - node.y0
      const x = (node.x0 + node.x1) / 2 - size / 2
      const z = (node.y0 + node.y1) / 2 - size / 2

      if (node.depth === 1) {
        districtList.push({ name: node.data.name, position: [x, 0, z], size: [w, 0.2, d] })
      } else if (!node.children && node.data.file) {
        const f = node.data.file
        const bw = Math.max(w * 0.82, 2.8)
        const bd = Math.max(d * 0.82, 2.8)
        // Sqrt scaling instead of linear: a 700-LOC outlier file no longer towers
        // 7x over a 100-LOC file — same principle as CodeCity's boxplot-based height
        // mapping, which exists specifically so one large class doesn't dominate the skyline.
        const h = Math.min(Math.max(3 + Math.sqrt(f.linesOfCode || 20) * 0.95, 4), 27)
        buildingList.push({ position: [x, 0, z], size: [bw, h, bd], file: f, district: node.parent.data.name })
      }
    })
    // Second pass: attach each district's tallest building height, so labels
    // can float above the skyline (natural vertical separation) instead of
    // all sitting flat at ground level where they overlap on screen.
    const maxHeightByDistrict = {}
    buildingList.forEach((b) => {
      const cur = maxHeightByDistrict[b.district] || 0
      if (b.size[1] > cur) maxHeightByDistrict[b.district] = b.size[1]
    })
    districtList.forEach((d) => {
      d.maxHeight = (maxHeightByDistrict[d.name] || 4) + 2.5
    })
    return { buildings: buildingList, districts: districtList, gridSize: size }
  }, [data])

  // Mission State
  const isMissionActive = !!selectedTask
  const targetPaths = selectedTask?.relevantFiles?.map(f => f.path) || []
  const trapPaths = selectedTask?.knownTraps?.map(t => t.path || t.file) || []

  // Resolve hover logic
  const hoveredBuilding = buildings.find(b => b.file.path === hoveredFile)
  const hoveredDistrict = hoveredBuilding?.district

  // Send HUD info out
  useEffect(() => {
    if (hoveredBuilding) {
      onHoverInfo(hoveredBuilding.file)
    } else {
      onHoverInfo(null)
    }
  }, [hoveredBuilding, onHoverInfo])

  return (
    <>
      <color attach="background" args={['#12213f']} />
      <fog attach="fog" args={['#5c5a68', 45, 180]} />
      <CityAtmosphere />
      <ambientLight intensity={0.35} color="#5a6b8c" />
      <hemisphereLight args={['#3a4a7a', '#1c1d22', 0.6]} />

      {/* Key light — warm sunset glow keyed to the sun disc */}
      <pointLight position={[160, 60, -250]} intensity={2.0} color="#ffb672" distance={400} />
      {/* Low cool fill so building bases & floor near the camera stay readable */}
      <pointLight position={[0, 8, 40]} intensity={0.6} color="#8fb3d9" distance={120} />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <planeGeometry args={[gridSize + 100, gridSize + 100]} />
        <MeshReflectorMaterial
          blur={[400, 100]}
          resolution={1024}
          mixBlur={1}
          mixStrength={1.2}
          roughness={0.4}
          depthScale={1.2}
          color="#1c1d22"
          metalness={0.35}
          mirror={0.35}
        />
      </mesh>
      {/* Pavement seam lines — barely-visible gray grid instead of a glowing Tron overlay,
          just enough structure to read as paved ground from a distance */}
      <Grid
        position={[0, -0.05, 0]}
        args={[gridSize + 100, gridSize + 100]}
        cellSize={2}
        cellThickness={0.4}
        cellColor="#3a3a3d"
        sectionSize={10}
        sectionThickness={0.6}
        sectionColor="#55565c"
        fadeDistance={140}
        fadeStrength={1.5}
        infiniteGrid
      />

      {/* Street layer — sits above the grid/reflector but below district platforms, so it
          only shows through in the gaps between districts, reading as roads/plazas that
          separate neighborhoods instead of bare reflective floor. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[gridSize + 6, gridSize + 6]} />
        <meshStandardMaterial color="#26272c" roughness={0.75} metalness={0.1} transparent opacity={0.95} />
      </mesh>

      {/* Environment Elements */}
      <HovercraftTraffic count={Math.round(gridSize * 1.2)} bounds={gridSize + 20} />
      <DependencyBridges buildings={buildings} isMissionActive={isMissionActive} targetPaths={targetPaths} />
      {isMissionActive && <GPSRoute buildings={buildings} targetPaths={targetPaths} />}
      <AtmosphericParticles />

      {/* Districts */}
      {districts.map((d, i) => {
        const isDimmed = isMissionActive && !targetPaths.some(p => buildings.find(b => b.file.path === p)?.district === d.name)
        return <DistrictPlatform key={`d-${i}`} position={d.position} size={d.size} name={d.name} isDimmed={isDimmed} maxHeight={d.maxHeight} />
      })}

      {/* Buildings */}
      {buildings.map((b, i) => {
        const isTarget = targetPaths.includes(b.file.path)
        const isTrap = trapPaths.includes(b.file.path)
        const isHover = hoveredFile === b.file.path
        const isNeighborHovered = !isHover && hoveredDistrict === b.district

        return (
          <CyberBuilding
            key={`b-${i}`}
            position={b.position}
            size={b.size}
            file={b.file}
            isHovered={isHover}
            isNeighborHovered={isNeighborHovered}
            isMissionActive={isMissionActive}
            isMissionTarget={isTarget}
            isMissionTrap={isTrap}
            onPointerOver={() => setHoveredFile(b.file.path)}
            onPointerOut={() => setHoveredFile(null)}
            onClick={() => setSelectedBuilding(b === selectedBuilding ? null : b)}
          />
        )
      })}

      <OrbitControls
        makeDefault
        target={[0, 6, 0]}
        enableDamping
        dampingFactor={0.05}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={10}
        maxDistance={200}
      />

      <CameraController
        selectedBuilding={selectedBuilding}
        isMissionActive={isMissionActive}
        gpsStartPoint={buildings.find(b => b.file.path === targetPaths[0])?.position}
      />

      <CyberEffects />
    </>
  )
}

/* ── Floating Hover Card (Replacing old stats panel) ──── */
function HoverInfoCard({ file }) {
  if (!file) return null
  return (
    <div className="arch-hover-card" style={{
      position: 'absolute', bottom: '32px', right: '32px',
      background: 'rgba(15, 17, 26, 0.85)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(76, 141, 255, 0.4)', borderRadius: '12px',
      padding: '20px', width: '300px', color: '#fff',
      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
      animation: 'fadeUp 0.3s ease-out'
    }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div style={{ fontSize: '10px', color: '#4c8dff', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
        {file.directory || 'Root'} District
      </div>
      <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', wordBreak: 'break-all' }}>
        {file.path.split('/').pop()}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px', color: '#9ca3af' }}>
        <div><strong style={{ color: '#fff' }}>{file.linesOfCode || 0}</strong> LOC</div>
        <div><strong style={{ color: '#fff' }}>{file.size ? (file.size / 1024).toFixed(1) + 'kb' : 'Unknown'}</strong></div>
        <div>Risk: <strong style={{ color: RISK_COLORS[getRiskTier(file.riskScore || 1)].hex }}>{file.riskScore || 1}/10</strong></div>
        <div>{file.semanticPurpose ? 'Analyzed' : 'Raw'}</div>
      </div>
      {file.semanticPurpose && (
        <div style={{ marginTop: '16px', fontSize: '12px', color: '#d1d5db', lineHeight: '1.4', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
          {file.semanticPurpose}
        </div>
      )}
    </div>
  )
}

/* ── Difficulty Badge Color ────────────────────────────── */
function difficultyColor(d) {
  if (!d) return '#94a3b8'
  const l = d.toLowerCase()
  if (l === 'low') return '#4ade80'
  if (l === 'medium' || l === 'moderate') return '#facc15'
  return '#f87171' // high / critical
}

/* ── Main MapView ─────────────────────────────────────── */
export default function MapView({ data, selectedTask }) {
  const [hoveredInfo, setHoveredInfo] = useState(null)

  return (
    <ErrorBoundary
      fallbackTitle="Architecture Map unavailable"
      fallbackMessage="The 3D renderer encountered an issue. Try another view."
    >
      <div className="arch-view" style={{ width: '100%', height: '100%', position: 'relative' }}>
        <Suspense fallback={
          <div className="hud-analyzing" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
            <div className="hud-analyzing__spinner" style={{ margin: '0 auto 16px', width: '32px', height: '32px', border: '3px solid #4f46e5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <div className="hud-analyzing__text" style={{ color: '#fff', fontFamily: 'JetBrains Mono' }}>Loading city view…</div>
          </div>
        }>
          <Canvas
            shadows={false}
            camera={{ position: [70, 55, 85], fov: 45, near: 0.1, far: 500 }}
            gl={{ antialias: false, alpha: false, toneMapping: THREE.NoToneMapping, powerPreference: "high-performance" }}
            dpr={[1, 2]} // limit dpr for performance with heavy post-processing
          >
            <CityScene
              data={data}
              selectedTask={selectedTask}
              onHoverInfo={setHoveredInfo}
            />
          </Canvas>
        </Suspense>

        {/* ── HUD: Top-left title panel ── */}
        <div className="arch-title-overlay">
          Immersive Code Metropolis Map
        </div>

        {/* ── HUD: Task tracking badge ── */}
        {selectedTask && (
          <div style={{ position: 'absolute', top: '60px', left: '20px', background: 'rgba(76, 141, 255, 0.12)', border: '1px solid #4c8dff', padding: '8px 16px', borderRadius: '6px', color: '#4c8dff', fontWeight: 'bold', fontFamily: 'JetBrains Mono', fontSize: '0.75rem', backdropFilter: 'blur(4px)', zIndex: 10 }}>
            TRACKING: {selectedTask.name}
          </div>
        )}

        {/* ── HUD: Top-right legend panel ── */}
        <div className="arch-hud-panel arch-hud-panel--tr">
          <div className="arch-hud-panel__label">Risk Legend</div>
          {Object.entries(RISK_COLORS).map(([key, val]) => (
            <div className="arch-hud-panel__row" key={key}>
              <div className="arch-hud-panel__dot" style={{ background: val.hex }} />
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </div>
          ))}
        </div>

        {/* ── HUD: Bottom status bar ── */}
        <div className="arch-status-bar">
          <div className="arch-status-bar__stats">
            <div>Files: <span>{data.repo.totalFiles}</span></div>
            <div>Lines of Code: <span>{data.repo.totalLOC?.toLocaleString()}</span></div>
            <div>Difficulty: <span style={{ color: difficultyColor(data.repo.difficulty), fontWeight: 600 }}>{data.repo.difficulty}</span></div>
          </div>
          <div className="arch-status-bar__desc">
            Architecture map of {data.repo.name}. Building height = LOC, color = risk.
          </div>
        </div>

        <HoverInfoCard file={hoveredInfo} />
      </div>
    </ErrorBoundary>
  )
}