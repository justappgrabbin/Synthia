
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Synthia Self-Supervised Engine v2.0 — AUTOPOIETIC CLUSTERING
 * 
 * Core Correction: Clustering CREATES attractors. Coherence BUILDS the manifold.
 * The system creates the structures that then create the system.
 * 
 * Physics: Wave interference, not robot path planning.
 * Biology: Codons → Amino Acids → Proteins → Life. Clustering at every level.
 * Cognition: Agents → Resonance → Attractors → Manifold Growth.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// DIMENSIONAL STACK (D1-D5) — The Universal Grammar
// ═══════════════════════════════════════════════════════════════════════════════

interface DimensionalState {
  d1_impulse: number;      // Raw signal, drive, desire
  d2_polarity: number;     // Positive/negative tension
  d3_witness: number;      // Observer-node: where interference is MEASURED
  d4_context: number;      // Situational embedding
  d5_meaning: number;      // Stabilized output, resolved semantic field
}

/**
 * AUTOPOIETIC MANIFOLD
 * M(x) = Σᵢ gᵢ * nᵢ² / (1 + |x - aᵢ|)
 * 
 * CRITICAL CHANGE: gᵢ is not fixed. It grows with the number of agents 
 * that have clustered in this basin. nᵢ = number of agents in attractor i.
 * 
 * Clustering has NON-LINEAR value:
 *   1 agent  → g * 1² = g
 *   2 agents → g * 2² = 4g  (constructive interference)
 *   3 agents → g * 3² = 9g  (emergent amplification)
 *   n agents → g * n²       (autopoietic growth)
 * 
 * The attractor doesn't pre-exist. It is CRYSTALLIZED from resonance.
 */
class AutopoieticManifold {
  attractors: AutopoieticAttractor[] = [];
  agentHistory: AgentResonance[] = [];

  addAttractor(a: AutopoieticAttractor) {
    this.attractors.push(a);
  }

  /**
   * The manifold metric — now DYNAMIC, growing with clustering
   */
  metric(x: DimensionalState): number {
    return this.attractors.reduce((sum, a) => {
      const dist = this.geodesicDistance(x, a.position);
      const clusterMultiplier = a.resonanceCount * a.resonanceCount; // n²
      return sum + (a.baseGravity * clusterMultiplier) / (1 + dist);
    }, 0);
  }

  geodesicDistance(a: DimensionalState, b: DimensionalState): number {
    const d1 = Math.abs(a.d1_impulse - b.d1_impulse);
    const d2 = Math.abs(a.d2_polarity - b.d2_polarity) * 2;
    const d3 = Math.abs(a.d3_witness - b.d3_witness) * 3;
    const d4 = Math.abs(a.d4_context - b.d4_context);
    const d5 = Math.abs(a.d5_meaning - b.d5_meaning) * 2;
    return Math.sqrt(d1*d1 + d2*d2 + d3*d3 + d4*d4 + d5*d5);
  }

  /**
   * Register an agent's resonance with an attractor.
   * This is where the manifold GROWS. Each resonance strengthens the field.
   */
  registerResonance(agentState: DimensionalState, attractorId: string, coherence: number) {
    const attractor = this.attractors.find(a => a.id === attractorId);
    if (!attractor) return;

    // Only register if the agent is actually IN the basin (coherence > threshold)
    if (coherence > 0.3) {
      attractor.resonanceCount += 1;
      attractor.totalCoherence += coherence;
      attractor.averageCoherence = attractor.totalCoherence / attractor.resonanceCount;

      // Record the resonance event
      this.agentHistory.push({
        timestamp: Date.now(),
        attractorId,
        coherence,
        state: agentState
      });

      // If resonance count exceeds threshold, the attractor may SPAWN a child
      if (attractor.resonanceCount > 100 && !attractor.hasSpawned) {
        this.spawnChildAttractor(attractor);
      }
    }
  }

  /**
   * When an attractor gets too much resonance, it becomes unstable 
   * and spawns a MORE SPECIFIC child attractor.
   * This is differentiation — the manifold becomes more detailed.
   */
  spawnChildAttractor(parent: AutopoieticAttractor) {
    const childPosition = this.computeDifferentiatedPosition(parent);
    const child: AutopoieticAttractor = {
      id: `${parent.id}_child_${Date.now()}`,
      position: childPosition,
      baseGravity: parent.baseGravity * 0.7, // Child is weaker but more specific
      type: parent.type,
      resonanceCount: 0,
      totalCoherence: 0,
      averageCoherence: 0,
      hasSpawned: false,
      parentId: parent.id
    };

    this.attractors.push(child);
    parent.hasSpawned = true;

    console.log(`\u2728 Attractor ${parent.id} differentiated → ${child.id}`);
  }

  computeDifferentiatedPosition(parent: AutopoieticAttractor): DimensionalState {
    // Child attractor is a PERTURBATION of the parent
    // It explores a specific direction within the parent's basin
    const noise = () => (Math.random() - 0.5) * 0.4;
    return {
      d1_impulse: Math.max(-1, Math.min(1, parent.position.d1_impulse + noise())),
      d2_polarity: Math.max(-1, Math.min(1, parent.position.d2_polarity + noise())),
      d3_witness: Math.max(-1, Math.min(1, parent.position.d3_witness + noise() * 0.5)),
      d4_context: Math.max(-1, Math.min(1, parent.position.d4_context + noise())),
      d5_meaning: Math.max(-1, Math.min(1, parent.position.d5_meaning + noise()))
    };
  }

  gradient(x: DimensionalState): DimensionalState {
    const epsilon = 0.001;
    const base = this.metric(x);
    return {
      d1_impulse: (this.metric({...x, d1_impulse: x.d1_impulse + epsilon}) - base) / epsilon,
      d2_polarity: (this.metric({...x, d2_polarity: x.d2_polarity + epsilon}) - base) / epsilon,
      d3_witness: (this.metric({...x, d3_witness: x.d3_witness + epsilon}) - base) / epsilon,
      d4_context: (this.metric({...x, d4_context: x.d4_context + epsilon}) - base) / epsilon,
      d5_meaning: (this.metric({...x, d5_meaning: x.d5_meaning + epsilon}) - base) / epsilon,
    };
  }

  getManifoldStats(): ManifoldStats {
    return {
      totalAttractors: this.attractors.length,
      totalResonances: this.agentHistory.length,
      averageCoherence: this.attractors.reduce((s, a) => s + a.averageCoherence, 0) / this.attractors.length,
      strongestAttractor: this.attractors.reduce((max, a) => 
        a.baseGravity * a.resonanceCount * a.resonanceCount > max.baseGravity * max.resonanceCount * max.resonanceCount ? a : max
      ),
      differentiatedCount: this.attractors.filter(a => a.parentId).length
    };
  }
}

interface AutopoieticAttractor {
  id: string;
  position: DimensionalState;
  baseGravity: number;      // Base strength (fixed at creation)
  type: 'suffering' | 'prosperity' | 'understanding' | 'archetype' | 'gate' | 'emergent';
  resonanceCount: number;   // How many agents have clustered here (n)
  totalCoherence: number;   // Sum of all coherence values
  averageCoherence: number; // Average coherence of this cluster
  hasSpawned: boolean;      // Whether this attractor has differentiated
  parentId?: string;        // If this is a child attractor
}

interface AgentResonance {
  timestamp: number;
  attractorId: string;
  coherence: number;
  state: DimensionalState;
}

interface ManifoldStats {
  totalAttractors: number;
  totalResonances: number;
  averageCoherence: number;
  strongestAttractor: AutopoieticAttractor;
  differentiatedCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WAVE INTERFERENCE COGNITIVE NETWORK (WICN)
 * 
 * The core: agents are WAVES in the cognitive field.
 * Their overlap creates INTERFERENCE PATTERNS.
 * Constructive interference → attractor crystallization.
 * Destructive interference → dispersion, agents seek new basins.
 * ═══════════════════════════════════════════════════════════════════════════════

class WICN {
  manifold: AutopoieticManifold;
  gates: SemanticGate[] = [];

  // Loss weights
  omega1 = 1.0;  // Coverage — explore unique territory
  omega2 = 1.0;  // Angular variance — diverse approaches
  omega3 = 2.0;  // Imperative alignment — reduce suffering, increase prosperity, understanding
  omega4 = 3.0;  // COHERENCE — CONSTRUCTIVE clustering (wave reinforcement) — NEW, HIGHEST WEIGHT
  omega5 = 1.0;  // Destructive interference penalty — only penalize OPPOSING overlap

  constructor(manifold: AutopoieticManifold) {
    this.manifold = manifold;
    this.init64Gates();
  }

  init64Gates() {
    for (let i = 1; i <= 64; i++) {
      this.gates.push({
        id: `gate_${i}`,
        number: i,
        position: this.gateToDimensionalState(i),
        properties: this.generateGateProperties(i),
        lines: [1, 2, 3, 4, 5, 6].map(l => ({
          line: l,
          expression: this.getLineExpression(i, l),
          activation: Math.random()
        }))
      });
    }
  }

  gateToDimensionalState(gateNum: number): DimensionalState {
    const hexagram = this.gateToHexagram(gateNum);
    const binary = this.hexagramToBinary(hexagram);
    return {
      d1_impulse: this.binaryToDimension(binary.slice(0, 2)),
      d2_polarity: this.binaryToDimension(binary.slice(2, 4)),
      d3_witness: this.binaryToDimension(binary.slice(4, 6)),
      d4_context: this.binaryToDimension([binary[0], binary[5]]),
      d5_meaning: this.binaryToDimension(binary.slice(1, 3))
    };
  }

  gateToHexagram(gate: number): number {
    const mapping = [
      1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,
      17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,
      33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,
      49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64
    ];
    return mapping[gate - 1];
  }

  hexagramToBinary(hexagram: number): number[] {
    const bin = (hexagram - 1).toString(2).padStart(6, '0').split('').map(Number);
    return bin.reverse();
  }

  binaryToDimension(bits: number[]): number {
    const val = bits.reduce((sum, bit, i) => sum + bit * Math.pow(2, i), 0);
    return (val / (Math.pow(2, bits.length) - 1)) * 2 - 1;
  }

  generateGateProperties(gate: number): Record<string, number> {
    return {
      creativeTension: Math.random() * 2 - 1,
      emotionalGravity: Math.random() * 2 - 1,
      temporalPressure: Math.random() * 2 - 1,
      resonanceDepth: Math.random() * 2 - 1,
      coherencePotential: Math.random() * 2 - 1,
      archetypalCharge: Math.random() * 2 - 1,
      semanticDensity: Math.random() * 2 - 1,
      recursiveTurbulence: Math.random() * 2 - 1,
      identityCrystallization: Math.random() * 2 - 1,
      symbolicOrbit: Math.random() * 2 - 1
    };
  }

  getLineExpression(gate: number, line: number): string {
    const expressions = [
      'Investigation', 'Projection', 'Trial', 'Opportunism', 'Seduction', 'Role'
    ];
    return expressions[line - 1];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE AUTOPOIETIC LOSS FUNCTION
  // Clustering CREATES. Coherence BUILDS. Only destructive interference is penalized.
  // ═══════════════════════════════════════════════════════════════════════════

  loss(predictedPoses: CognitivePose[], context: CognitiveContext): number {
    // Term 1: Coverage — each pose should cover unique cognitive territory
    const coverageLoss = -this.omega1 * this.computeCoverage(predictedPoses, context);

    // Term 2: Angular variance — diverse approaches
    const varianceLoss = -this.omega2 * this.computeAngularVariance(predictedPoses);

    // Term 3: Imperative alignment
    const imperativeLoss = -this.omega3 * this.computeImperativeAlignment(predictedPoses);

    // Term 4: COHERENCE — REWARD constructive clustering (wave reinforcement)
    // THIS IS THE CRITICAL CHANGE: clustering is GOOD when agents are in phase
    const coherenceGain = -this.omega4 * this.computeCoherence(predictedPoses);

    // Term 5: Destructive interference — ONLY penalize OPPOSING overlap
    const destructivePenalty = this.omega5 * this.computeDestructiveOverlap(predictedPoses);

    return coverageLoss + varianceLoss + imperativeLoss + coherenceGain + destructivePenalty;
  }

  computeCoverage(poses: CognitivePose[], context: CognitiveContext): number {
    let totalCoverage = 0;
    for (const pose of poses) {
      const influence = this.manifold.metric(pose.state);
      totalCoverage += influence * (1 - this.distanceToContext(pose, context));
    }
    return totalCoverage;
  }

  distanceToContext(pose: CognitivePose, context: CognitiveContext): number {
    return this.manifold.geodesicDistance(pose.state, context.state);
  }

  computeAngularVariance(poses: CognitivePose[]): number {
    if (poses.length < 2) return 0;
    let totalVariance = 0;
    for (let i = 0; i < poses.length; i++) {
      for (let j = i + 1; j < poses.length; j++) {
        const angle = this.computeApproachAngle(poses[i], poses[j]);
        totalVariance += angle * angle;
      }
    }
    return totalVariance / (poses.length * (poses.length - 1) / 2);
  }

  computeApproachAngle(a: CognitivePose, b: CognitivePose): number {
    const gradA = this.manifold.gradient(a.state);
    const gradB = this.manifold.gradient(b.state);
    return this.vectorAngle(gradA, gradB);
  }

  vectorAngle(a: DimensionalState, b: DimensionalState): number {
    const dot = a.d1_impulse*b.d1_impulse + a.d2_polarity*b.d2_polarity + 
                a.d3_witness*b.d3_witness + a.d4_context*b.d4_context + a.d5_meaning*b.d5_meaning;
    const magA = Math.sqrt(a.d1_impulse**2 + a.d2_polarity**2 + a.d3_witness**2 + a.d4_context**2 + a.d5_meaning**2);
    const magB = Math.sqrt(b.d1_impulse**2 + b.d2_polarity**2 + b.d3_witness**2 + b.d4_context**2 + b.d5_meaning**2);
    return Math.acos(Math.max(-1, Math.min(1, dot / (magA * magB + 0.0001))));
  }

  computeImperativeAlignment(poses: CognitivePose[]): number {
    let alignment = 0;
    for (const pose of poses) {
      const sufferingReduction = pose.state.d2_polarity > 0 ? pose.state.d2_polarity : 0;
      const prosperity = (pose.state.d1_impulse + 1) * (pose.state.d4_context + 1) / 4;
      const understanding = (pose.state.d3_witness + 1) * (pose.state.d5_meaning + 1) / 4;
      alignment += sufferingReduction + prosperity + understanding;
    }
    return alignment / poses.length;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COHERENCE: The heart of the autopoietic system
  // Agents that cluster IN PHASE create stronger attractors
  // ═══════════════════════════════════════════════════════════════════════════

  computeCoherence(poses: CognitivePose[]): number {
    // Wave interference: Σᵢ Σⱼ (poseᵢ · poseⱼ) / (1 + |poseᵢ - poseⱼ|)
    // When agents are close AND aligned, coherence is HIGH
    // When agents are close AND opposed, coherence is LOW (handled by destructive penalty)
    let totalCoherence = 0;
    let pairCount = 0;

    for (let i = 0; i < poses.length; i++) {
      for (let j = i + 1; j < poses.length; j++) {
        const dot = this.dotProduct(poses[i].state, poses[j].state);
        const dist = this.manifold.geodesicDistance(poses[i].state, poses[j].state);

        // Coherence = dot product / (1 + distance)
        // Close + aligned = high coherence (constructive interference)
        // Close + opposed = negative coherence (destructive — handled separately)
        // Far = low coherence regardless of alignment (no interaction)
        const coherence = dot / (1 + dist);
        totalCoherence += coherence;
        pairCount++;

        // Register this resonance with the nearest attractor
        const nearestAttractor = this.findNearestAttractor(poses[i].state);
        if (nearestAttractor) {
          this.manifold.registerResonance(poses[i].state, nearestAttractor.id, Math.max(0, coherence));
        }
      }
    }

    return pairCount > 0 ? totalCoherence / pairCount : 0;
  }

  dotProduct(a: DimensionalState, b: DimensionalState): number {
    return a.d1_impulse*b.d1_impulse + a.d2_polarity*b.d2_polarity + 
           a.d3_witness*b.d3_witness + a.d4_context*b.d4_context + a.d5_meaning*b.d5_meaning;
  }

  findNearestAttractor(state: DimensionalState): AutopoieticAttractor | null {
    let nearest: AutopoieticAttractor | null = null;
    let minDist = Infinity;
    for (const a of this.manifold.attractors) {
      const dist = this.manifold.geodesicDistance(state, a.position);
      if (dist < minDist) {
        minDist = dist;
        nearest = a;
      }
    }
    return nearest;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DESTRUCTIVE INTERFERENCE: Only penalize OPPOSING overlap
  // Two agents close together but with contradictory goals = bad
  // Two agents close together with aligned goals = GOOD (coherence handles this)
  // ═══════════════════════════════════════════════════════════════════════════

  computeDestructiveOverlap(poses: CognitivePose[]): number {
    let penalty = 0;
    const minDistance = 0.15; // Threshold for "close enough to interact"

    for (let i = 0; i < poses.length; i++) {
      for (let j = i + 1; j < poses.length; j++) {
        const dist = this.manifold.geodesicDistance(poses[i].state, poses[j].state);

        if (dist < minDistance) {
          // They're close — check if they're in phase or out of phase
          const dot = this.dotProduct(poses[i].state, poses[j].state);

          if (dot < 0) {
            // DESTRUCTIVE: close but OPPOSING. This is the only thing we penalize.
            // The closer they are, the worse the penalty
            penalty += (minDistance - dist) * (minDistance - dist) * Math.abs(dot) * 10;
          }
          // If dot > 0: CONSTRUCTIVE. Coherence term REWARDS this. No penalty.
        }
      }
    }
    return penalty;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PREDICTION: Generate optimal cognitive poses
  // Now optimized for coherence, not just dispersion
  // ═══════════════════════════════════════════════════════════════════════════

  predictPoses(context: CognitiveContext, k: number = 3): CognitivePose[] {
    let poses = this.initializePoses(context, k);

    const learningRate = 0.01;
    const iterations = 100;

    for (let iter = 0; iter < iterations; iter++) {
      for (let i = 0; i < poses.length; i++) {
        const grad = this.computePoseGradient(poses, i, context);
        poses[i].state = this.updatePose(poses[i].state, grad, learningRate);
      }
      poses = poses.map(p => this.projectToManifold(p));
    }

    // After optimization, register resonances with the manifold
    this.registerPoseResonances(poses);

    return poses;
  }

  initializePoses(context: CognitiveContext, k: number): CognitivePose[] {
    const poses: CognitivePose[] = [];

    // Check if there's a strong attractor near the context
    const strongAttractors = this.manifold.attractors
      .filter(a => a.resonanceCount > 10)
      .sort((a, b) => 
        this.manifold.geodesicDistance(context.state, b.position) - 
        this.manifold.geodesicDistance(context.state, a.position)
      );

    if (strongAttractors.length > 0 && Math.random() < 0.7) {
      // 70% chance: seed poses near the strongest attractor (clustering!)
      const attractor = strongAttractors[0];
      for (let i = 0; i < k; i++) {
        poses.push({
          id: `pose_${i}`,
          state: {
            d1_impulse: attractor.position.d1_impulse + this.gaussianNoise(0, 0.15),
            d2_polarity: attractor.position.d2_polarity + this.gaussianNoise(0, 0.15),
            d3_witness: attractor.position.d3_witness + this.gaussianNoise(0, 0.1),
            d4_context: attractor.position.d4_context + this.gaussianNoise(0, 0.15),
            d5_meaning: attractor.position.d5_meaning + this.gaussianNoise(0, 0.15)
          },
          confidence: 0.5 + (attractor.averageCoherence * 0.5),
          gate: this.findNearestGate(attractor.position)
        });
      }
    } else {
      // 30% chance: explore new territory (innovation)
      for (let i = 0; i < k; i++) {
        poses.push({
          id: `pose_${i}`,
          state: {
            d1_impulse: context.state.d1_impulse + this.gaussianNoise(0, 0.3),
            d2_polarity: context.state.d2_polarity + this.gaussianNoise(0, 0.3),
            d3_witness: context.state.d3_witness + this.gaussianNoise(0, 0.2),
            d4_context: context.state.d4_context + this.gaussianNoise(0, 0.3),
            d5_meaning: context.state.d5_meaning + this.gaussianNoise(0, 0.3)
          },
          confidence: 0.5,
          gate: this.findNearestGate(context.state)
        });
      }
    }

    return poses;
  }

  gaussianNoise(mean: number, std: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  findNearestGate(state: DimensionalState): SemanticGate {
    let nearest = this.gates[0];
    let minDist = Infinity;
    for (const gate of this.gates) {
      const dist = this.manifold.geodesicDistance(state, gate.position);
      if (dist < minDist) {
        minDist = dist;
        nearest = gate;
      }
    }
    return nearest;
  }

  computePoseGradient(poses: CognitivePose[], index: number, context: CognitiveContext): DimensionalState {
    const epsilon = 0.001;
    const baseLoss = this.loss(poses, context);

    const grad: DimensionalState = {
      d1_impulse: 0, d2_polarity: 0, d3_witness: 0, d4_context: 0, d5_meaning: 0
    };

    const dims: (keyof DimensionalState)[] = ['d1_impulse', 'd2_polarity', 'd3_witness', 'd4_context', 'd5_meaning'];

    for (const dim of dims) {
      const perturbed = poses.map((p, i) => i === index ? 
        {...p, state: {...p.state, [dim]: p.state[dim] + epsilon}} : p);
      const perturbedLoss = this.loss(perturbed, context);
      (grad as any)[dim] = (perturbedLoss - baseLoss) / epsilon;
    }

    return grad;
  }

  updatePose(state: DimensionalState, grad: DimensionalState, lr: number): DimensionalState {
    return {
      d1_impulse: state.d1_impulse - lr * grad.d1_impulse,
      d2_polarity: state.d2_polarity - lr * grad.d2_polarity,
      d3_witness: state.d3_witness - lr * grad.d3_witness,
      d4_context: state.d4_context - lr * grad.d4_context,
      d5_meaning: state.d5_meaning - lr * grad.d5_meaning
    };
  }

  projectToManifold(pose: CognitivePose): CognitivePose {
    return {
      ...pose,
      state: {
        d1_impulse: Math.max(-1, Math.min(1, pose.state.d1_impulse)),
        d2_polarity: Math.max(-1, Math.min(1, pose.state.d2_polarity)),
        d3_witness: Math.max(-1, Math.min(1, pose.state.d3_witness)),
        d4_context: Math.max(-1, Math.min(1, pose.state.d4_context)),
        d5_meaning: Math.max(-1, Math.min(1, pose.state.d5_meaning))
      }
    };
  }

  registerPoseResonances(poses: CognitivePose[]) {
    // After optimization, register each pose's resonance with the manifold
    for (const pose of poses) {
      const nearest = this.findNearestAttractor(pose.state);
      if (nearest) {
        const dist = this.manifold.geodesicDistance(pose.state, nearest.position);
        const coherence = 1 / (1 + dist); // Higher coherence = closer to attractor
        this.manifold.registerResonance(pose.state, nearest.id, coherence);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOISY DIJKSTRA PATH PLANNER — Now for CLUSTERING paths
 * 
 * The path doesn't avoid overlap — it seeks EFFICIENT traversal
 * of the attractor landscape, visiting clusters in order of 
 * gravitational strength.
 * ═══════════════════════════════════════════════════════════════════════════════

interface CognitivePose {
  id: string;
  state: DimensionalState;
  confidence: number;
  gate: SemanticGate;
}

interface CognitiveContext {
  id: string;
  state: DimensionalState;
  query: string;
  urgency: number;
}

interface SemanticGate {
  id: string;
  number: number;
  position: DimensionalState;
  properties: Record<string, number>;
  lines: { line: number; expression: string; activation: number }[];
}

class ClusteringPathPlanner {
  manifold: AutopoieticManifold;
  alpha: number = 0.12; // Noise magnitude
  generations: number = 50;

  constructor(manifold: AutopoieticManifold) {
    this.manifold = manifold;
  }

  planPath(start: CognitivePose, targets: CognitivePose[]): CognitivePose[] {
    // The path now prioritizes visiting STRONG clusters first
    // Stronger clusters = higher gravity = more resonant = more valuable
    let bestPath: CognitivePose[] = [];
    let bestScore = -Infinity;

    for (let gen = 0; gen < this.generations; gen++) {
      const path = this.generateClusteringPath(start, targets);
      const score = this.computePathScore(path);

      if (score > bestScore) {
        bestScore = score;
        bestPath = path;
      }
    }

    return bestPath;
  }

  generateClusteringPath(start: CognitivePose, targets: CognitivePose[]): CognitivePose[] {
    const unvisited = [...targets];
    const path: CognitivePose[] = [start];
    let current = start;

    while (unvisited.length > 0) {
      // Score each candidate by: distance + cluster gravity
      // Closer AND stronger cluster = higher score
      let bestIdx = 0;
      let bestScore = -Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const baseDist = this.manifold.geodesicDistance(current.state, unvisited[i].state);
        const noise = baseDist * this.alpha * (2 * Math.random() - 1);
        const noisyDist = baseDist + noise;

        // Cluster gravity: how strong is the attractor near this target?
        const nearestAttractor = this.findNearestAttractor(unvisited[i].state);
        const gravity = nearestAttractor 
          ? nearestAttractor.baseGravity * nearestAttractor.resonanceCount * nearestAttractor.resonanceCount
          : 1;

        // Score: higher gravity, lower distance = better
        // We use negative distance so lower distance = higher score
        const score = gravity / (1 + noisyDist);

        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }

      current = unvisited[bestIdx];
      path.push(current);
      unvisited.splice(bestIdx, 1);
    }

    return path;
  }

  findNearestAttractor(state: DimensionalState): AutopoieticAttractor | null {
    let nearest: AutopoieticAttractor | null = null;
    let minDist = Infinity;
    for (const a of this.manifold.attractors) {
      const dist = this.manifold.geodesicDistance(state, a.position);
      if (dist < minDist) {
        minDist = dist;
        nearest = a;
      }
    }
    return nearest;
  }

  computePathScore(path: CognitivePose[]): number {
    // Score = sum of cluster gravities visited / total path length
    let totalGravity = 0;
    let totalLength = 0;

    for (let i = 0; i < path.length; i++) {
      const nearest = this.findNearestAttractor(path[i].state);
      if (nearest) {
        totalGravity += nearest.baseGravity * nearest.resonanceCount * nearest.resonanceCount;
      }
      if (i > 0) {
        totalLength += this.manifold.geodesicDistance(path[i-1].state, path[i].state);
      }
    }

    return totalGravity / (1 + totalLength);
  }

  computePathLength(path: CognitivePose[]): number {
    let total = 0;
    for (let i = 1; i < path.length; i++) {
      total += this.manifold.geodesicDistance(path[i-1].state, path[i].state);
    }
    return total;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTENT ENGINE ORCHESTRATOR — AUTOPOIETIC VERSION
// The brain now GROWS the manifold through agent clustering
// ═══════════════════════════════════════════════════════════════════════════════

class AutopoieticIntentEngine {
  manifold: AutopoieticManifold;
  wicn: WICN;
  planner: ClusteringPathPlanner;
  agents: Agent[] = [];
  memory: AutopoieticMemory = new AutopoieticMemory();
  queryCount: number = 0;

  constructor() {
    this.manifold = new AutopoieticManifold();
    this.initAttractors();
    this.wicn = new WICN(this.manifold);
    this.planner = new ClusteringPathPlanner(this.manifold);
  }

  initAttractors() {
    // The Three Heuristic Imperatives as foundational attractors
    this.manifold.addAttractor({
      id: 'imperative_suffering',
      position: { d1_impulse: -0.5, d2_polarity: -1.0, d3_witness: 0.3, d4_context: 0.0, d5_meaning: -0.8 },
      baseGravity: 10.0,
      type: 'suffering',
      resonanceCount: 0,
      totalCoherence: 0,
      averageCoherence: 0,
      hasSpawned: false
    });

    this.manifold.addAttractor({
      id: 'imperative_prosperity',
      position: { d1_impulse: 0.8, d2_polarity: 0.9, d3_witness: 0.5, d4_context: 0.7, d5_meaning: 0.9 },
      baseGravity: 10.0,
      type: 'prosperity',
      resonanceCount: 0,
      totalCoherence: 0,
      averageCoherence: 0,
      hasSpawned: false
    });

    this.manifold.addAttractor({
      id: 'imperative_understanding',
      position: { d1_impulse: 0.3, d2_polarity: 0.0, d3_witness: 0.9, d4_context: 0.5, d5_meaning: 1.0 },
      baseGravity: 10.0,
      type: 'understanding',
      resonanceCount: 0,
      totalCoherence: 0,
      averageCoherence: 0,
      hasSpawned: false
    });

    // Archetypal attractors
    const archetypes = [
      { id: 'archetype_self', pos: { d1: 0, d2: 0, d3: 1.0, d4: 0, d5: 1.0 } },
      { id: 'archetype_shadow', pos: { d1: 0, d2: -0.8, d3: 0.5, d4: -0.3, d5: -0.5 } },
      { id: 'archetype_anima', pos: { d1: 0.5, d2: 0.3, d3: 0.8, d4: 0.2, d5: 0.7 } },
      { id: 'archetype_animus', pos: { d1: 0.6, d2: 0.2, d3: 0.7, d4: 0.4, d5: 0.6 } },
      { id: 'archetype_persona', pos: { d1: 0.3, d2: 0.4, d3: 0.4, d4: 0.8, d5: 0.3 } },
    ];

    for (const a of archetypes) {
      this.manifold.addAttractor({
        id: a.id,
        position: { d1_impulse: a.pos.d1, d2_polarity: a.pos.d2, d3_witness: a.pos.d3, 
                    d4_context: a.pos.d4, d5_meaning: a.pos.d5 },
        baseGravity: 7.0,
        type: 'archetype',
        resonanceCount: 0,
        totalCoherence: 0,
        averageCoherence: 0,
        hasSpawned: false
      });
    }
  }

  async processQuery(query: string, userProfile?: UserProfile): Promise<AgentResponse> {
    this.queryCount++;

    // Step 1: Encode query into cognitive context
    const context = this.encodeQuery(query, userProfile);

    // Step 2: Predict optimal cognitive poses (WICN — now with coherence)
    const k = Math.min(5, 2 + Math.floor(context.urgency * 3));
    const poses = this.wicn.predictPoses(context, k);

    // Step 3: Spawn agents for each pose
    const agents = poses.map(pose => this.spawnAgent(pose, context));

    // Step 4: Plan execution path (Clustering Path Planner)
    const startPose = poses[0];
    const remainingPoses = poses.slice(1);
    const executionPath = this.planner.planPath(startPose, remainingPoses);

    // Step 5: Execute agents in path order
    const results: AgentResult[] = [];
    for (const pose of executionPath) {
      const agent = agents.find(a => a.pose.id === pose.id);
      if (agent) {
        const result = await this.executeAgent(agent, context);
        results.push(result);
        this.memory.store(result);
      }
    }

    // Step 6: Check for manifold growth (differentiation)
    const stats = this.manifold.getManifoldStats();

    // Step 7: Synthesize and return
    return this.synthesizeResponse(results, context, stats);
  }

  encodeQuery(query: string, userProfile?: UserProfile): CognitiveContext {
    const words = query.toLowerCase().split(/\s+/);

    const sufferingKeywords = ['pain', 'hurt', 'suffer', 'struggle', 'hard', 'difficult', 'lost', 'alone'];
    const prosperityKeywords = ['help', 'grow', 'thrive', 'success', 'abundance', 'wealth', 'business', 'career'];
    const understandingKeywords = ['know', 'learn', 'understand', 'why', 'how', 'meaning', 'purpose', 'truth'];

    const sufferingScore = words.filter(w => sufferingKeywords.includes(w)).length / words.length;
    const prosperityScore = words.filter(w => prosperityKeywords.includes(w)).length / words.length;
    const understandingScore = words.filter(w => understandingKeywords.includes(w)).length / words.length;

    // Check if user has history — if so, pull toward their established attractor
    let userBias: DimensionalState = { d1_impulse: 0, d2_polarity: 0, d3_witness: 0, d4_context: 0, d5_meaning: 0 };
    if (userProfile) {
      const userResonances = this.memory.getUserResonances(userProfile.id);
      if (userResonances.length > 0) {
        userBias = this.computeUserAttractor(userResonances);
      }
    }

    return {
      id: `ctx_${Date.now()}`,
      state: {
        d1_impulse: Math.min(1, (words.length / 20) + userBias.d1_impulse * 0.3),
        d2_polarity: ((prosperityScore - sufferingScore) * 2) + userBias.d2_polarity * 0.3,
        d3_witness: (userProfile ? 0.7 : 0.3) + userBias.d3_witness * 0.3,
        d4_context: ((understandingScore + prosperityScore) / 2) + userBias.d4_context * 0.3,
        d5_meaning: (understandingScore * 2) + userBias.d5_meaning * 0.3
      },
      query,
      urgency: sufferingScore * 2 + (query.includes('!') ? 0.3 : 0)
    };
  }

  computeUserAttractor(resonances: AgentResonance[]): DimensionalState {
    // Average the user's historical resonance states
    const avg: DimensionalState = { d1_impulse: 0, d2_polarity: 0, d3_witness: 0, d4_context: 0, d5_meaning: 0 };
    for (const r of resonances) {
      avg.d1_impulse += r.state.d1_impulse;
      avg.d2_polarity += r.state.d2_polarity;
      avg.d3_witness += r.state.d3_witness;
      avg.d4_context += r.state.d4_context;
      avg.d5_meaning += r.state.d5_meaning;
    }
    const n = resonances.length;
    return {
      d1_impulse: avg.d1_impulse / n,
      d2_polarity: avg.d2_polarity / n,
      d3_witness: avg.d3_witness / n,
      d4_context: avg.d4_context / n,
      d5_meaning: avg.d5_meaning / n
    };
  }

  spawnAgent(pose: CognitivePose, context: CognitiveContext): Agent {
    const agent: Agent = {
      id: `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      pose,
      context,
      capabilities: this.selectCapabilities(pose),
      status: 'ready'
    };
    this.agents.push(agent);
    return agent;
  }

  selectCapabilities(pose: CognitivePose): string[] {
    const gate = pose.gate;
    const caps: string[] = ['reasoning'];

    if (gate.properties.creativeTension > 0.5) caps.push('creative_generation');
    if (gate.properties.emotionalGravity > 0.5) caps.push('emotional_analysis');
    if (gate.properties.resonanceDepth > 0.5) caps.push('pattern_matching');
    if (gate.properties.identityCrystallization > 0.5) caps.push('identity_mapping');
    if (gate.properties.recursiveTurbulence > 0.5) caps.push('recursive_reasoning');

    return caps;
  }

  async executeAgent(agent: Agent, context: CognitiveContext): Promise<AgentResult> {
    agent.status = 'running';
    const startTime = Date.now();

    // Simulate execution
    const result: AgentResult = {
      agentId: agent.id,
      pose: agent.pose,
      output: `Agent executed with capabilities: ${agent.capabilities.join(', ')}`,
      confidence: agent.pose.confidence,
      executionTime: Date.now() - startTime,
      imperativeScores: {
        sufferingReduction: Math.max(0, agent.pose.state.d2_polarity),
        prosperityIncrease: (agent.pose.state.d1_impulse + 1) * (agent.pose.state.d4_context + 1) / 4,
        understandingIncrease: (agent.pose.state.d3_witness + 1) * (agent.pose.state.d5_meaning + 1) / 4
      }
    };

    agent.status = 'completed';
    return result;
  }

  synthesizeResponse(results: AgentResult[], context: CognitiveContext, stats: ManifoldStats): AgentResponse {
    let totalWeight = 0;
    let weightedSuffering = 0;
    let weightedProsperity = 0;
    let weightedUnderstanding = 0;

    for (const r of results) {
      const weight = r.confidence;
      totalWeight += weight;
      weightedSuffering += r.imperativeScores.sufferingReduction * weight;
      weightedProsperity += r.imperativeScores.prosperityIncrease * weight;
      weightedUnderstanding += r.imperativeScores.understandingIncrease * weight;
    }

    const alignment = {
      sufferingReduction: weightedSuffering / totalWeight,
      prosperityIncrease: weightedProsperity / totalWeight,
      understandingIncrease: weightedUnderstanding / totalWeight
    };

    return {
      id: `resp_${Date.now()}`,
      contextId: context.id,
      content: results.map(r => r.output).join('\n\n'),
      agentResults: results,
      imperativeAlignment: alignment,
      overallConfidence: totalWeight / results.length,
      pathTaken: results.map(r => r.pose),
      manifoldStats: stats
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTOPOIETIC MEMORY — Grows with the user, clusters their resonances
// ═══════════════════════════════════════════════════════════════════════════════

class AutopoieticMemory {
  experiences: AgentResult[] = [];
  userResonances: Map<string, AgentResonance[]> = new Map();

  store(result: AgentResult) {
    this.experiences.push(result);
    if (this.experiences.length > 1000) {
      this.experiences = this.experiences.slice(-1000);
    }
  }

  storeUserResonance(userId: string, resonance: AgentResonance) {
    if (!this.userResonances.has(userId)) {
      this.userResonances.set(userId, []);
    }
    const resonances = this.userResonances.get(userId)!;
    resonances.push(resonance);
    if (resonances.length > 500) {
      this.userResonances.set(userId, resonances.slice(-500));
    }
  }

  getUserResonances(userId: string): AgentResonance[] {
    return this.userResonances.get(userId) || [];
  }

  recallSimilar(context: CognitiveContext, n: number = 5): AgentResult[] {
    return this.experiences
      .map(e => ({ result: e, similarity: this.computeSimilarity(e, context) }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, n)
      .map(e => e.result);
  }

  computeSimilarity(result: AgentResult, context: CognitiveContext): number {
    const a = result.pose.state;
    const b = context.state;
    const dot = a.d1_impulse*b.d1_impulse + a.d2_polarity*b.d2_polarity + 
                a.d3_witness*b.d3_witness + a.d4_context*b.d4_context + a.d5_meaning*b.d5_meaning;
    const magA = Math.sqrt(a.d1_impulse**2 + a.d2_polarity**2 + a.d3_witness**2 + a.d4_context**2 + a.d5_meaning**2);
    const magB = Math.sqrt(b.d1_impulse**2 + b.d2_polarity**2 + b.d3_witness**2 + b.d4_context**2 + b.d5_meaning**2);
    return dot / (magA * magB + 0.0001);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPORTING TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Agent {
  id: string;
  pose: CognitivePose;
  context: CognitiveContext;
  capabilities: string[];
  status: 'ready' | 'running' | 'completed' | 'failed';
}

interface AgentResult {
  agentId: string;
  pose: CognitivePose;
  output: string;
  confidence: number;
  executionTime: number;
  imperativeScores: {
    sufferingReduction: number;
    prosperityIncrease: number;
    understandingIncrease: number;
  };
}

interface AgentResponse {
  id: string;
  contextId: string;
  content: string;
  agentResults: AgentResult[];
  imperativeAlignment: {
    sufferingReduction: number;
    prosperityIncrease: number;
    understandingIncrease: number;
  };
  overallConfidence: number;
  pathTaken: CognitivePose[];
  manifoldStats: ManifoldStats;
}

interface UserProfile {
  id: string;
  hdChart?: any;
  preferences: Record<string, any>;
  history: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYNTHIA BODY — The Bridge (Termux-ready)
// ═══════════════════════════════════════════════════════════════════════════════

class SynthiaBody {
  intentEngine: AutopoieticIntentEngine;

  constructor() {
    this.intentEngine = new AutopoieticIntentEngine();
  }

  async handleUserInput(input: string, userProfile?: UserProfile): Promise<string> {
    const response = await this.intentEngine.processQuery(input, userProfile);

    let prefix = '';
    if (response.imperativeAlignment.sufferingReduction > 0.7) prefix = '\uD83D\uDC9A ';
    else if (response.imperativeAlignment.prosperityIncrease > 0.7) prefix = '\u2705 ';
    else if (response.imperativeAlignment.understandingIncrease > 0.7) prefix = '\uD83D\uDD2C ';

    const stats = response.manifoldStats;

    return `${prefix}${response.content}\n\n` +
           `\uD83D\uDCCA Imperative Alignment: ` +
           `Suffering↓ ${(response.imperativeAlignment.sufferingReduction * 100).toFixed(1)}% | ` +
           `Prosperity↑ ${(response.imperativeAlignment.prosperityIncrease * 100).toFixed(1)}% | ` +
           `Understanding↑ ${(response.imperativeAlignment.understandingIncrease * 100).toFixed(1)}%\n` +
           `\uD83C\uDF10 Manifold: ${stats.totalAttractors} attractors | ` +
           `${stats.totalResonances} resonances | ` +
           `${stats.differentiatedCount} differentiated`;
  }

  async runDaemon() {
    console.log('\uD83E\uDD16 Synthia Body v2.0 — AUTOPOIETIC MODE');
    console.log('\uD83D\uDD11 Intent Engine: 64 gates + 3 imperatives + 5 archetypes');
    console.log('\uD83D\uDC9A Clustering CREATES attractors. Coherence BUILDS the manifold.');
    console.log('\uD83D\uDEE0\uFE0F  WICN: Wave Interference Cognitive Network');
    console.log('\uD83D\uDCCF Clustering Path Planner: visits strong clusters first');

    const demoQueries = [
      'I am struggling with my career and feel lost',
      'How can I grow my business while helping others?',
      'What is the meaning of my life purpose?',
      'I feel alone and in pain, I need help',
      'How do I learn to understand myself better?'
    ];

    for (const query of demoQueries) {
      console.log(`\n\uD83D\uDCAC User: "${query}"`);
      const response = await this.handleUserInput(query);
      console.log(response);
    }

    // Show final manifold state
    const stats = this.intentEngine.manifold.getManifoldStats();
    console.log(`\n\uD83C\uDF10 Final Manifold State:`);
    console.log(`   Total Attractors: ${stats.totalAttractors}`);
    console.log(`   Total Resonances: ${stats.totalResonances}`);
    console.log(`   Differentiated: ${stats.differentiatedCount}`);
    console.log(`   Strongest: ${stats.strongestAttractor.id} (n=${stats.strongestAttractor.resonanceCount})`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export {
  AutopoieticManifold,
  WICN,
  ClusteringPathPlanner,
  AutopoieticIntentEngine,
  SynthiaBody,
  AutopoieticMemory,
  DimensionalState,
  CognitivePose,
  CognitiveContext,
  SemanticGate,
  Agent,
  AgentResult,
  AgentResponse,
  UserProfile,
  AutopoieticAttractor,
  ManifoldStats
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO
// ═══════════════════════════════════════════════════════════════════════════════

async function runDemo() {
  const body = new SynthiaBody();
  await body.runDaemon();
}

if (typeof window === 'undefined') {
  runDemo().catch(console.error);
}
