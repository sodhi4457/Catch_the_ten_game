# Dehla Pakad RL Bot — Research, Learning Plan & Build Roadmap

Before diving in: this is genuinely a great first RL project, but I want to set realistic expectations. "As soon as possible" for someone with zero RL background means roughly **6–10 weeks of consistent effort** if you want a bot that actually plays well, not just one that runs. You can have a working pipeline (random/weak bot in a real environment) in 2 weeks. Strong play takes longer because of the multi-agent and imperfect-information aspects.

The plan below is structured so you have something runnable at the end of every phase.

---

## Part 1 — Research: How This Gets Implemented in Python

### The standard architecture for this class of problem

A multi-agent card game RL system has four decoupled layers, and you should build them in this order:

1. **Pure game logic layer** — A Python class that knows the rules of Dehla Pakad. Deal cards, validate moves, track tricks, score the hand. No RL anywhere yet. This is just a card game simulator.

2. **Environment wrapper layer** — Wraps the game logic into a standardized RL interface (the "Gym API"). Exposes `reset()`, `step(action)`, observation space, action space. For multi-agent, this uses the PettingZoo API instead of single-agent Gymnasium.

3. **Agent/policy layer** — The neural network that maps observations → action probabilities. This is the "brain."

4. **Training loop layer** — Orchestrates self-play, collects experience, computes losses, updates the network, logs metrics.

### Library landscape (what people actually use in 2026)

- **PyTorch** — Default deep learning framework for RL research. More flexible than TensorFlow for custom architectures.
- **Gymnasium** — The maintained successor to OpenAI Gym. Defines the single-agent RL API.
- **PettingZoo** — Multi-agent extension of Gymnasium. Has an "AEC" (Agent Environment Cycle) API specifically designed for turn-based games like card games. This is exactly what you need.
- **Stable-Baselines3 (SB3)** — Pre-built, well-tested implementations of PPO, DQN, A2C, etc. Single-agent only, but useful for baselines.
- **CleanRL** — Single-file, readable RL implementations. The best learning resource — you can actually understand what's happening.
- **RLlib (Ray)** — Industrial-strength multi-agent RL. Has MAPPO built in. Steeper learning curve but designed for exactly your use case.
- **TorchRL** — Newer, more modular option. Worth knowing exists but not where to start.
- **Weights & Biases (wandb)** or **TensorBoard** — Experiment tracking. Non-negotiable; you cannot debug RL without good logging.

### Specific implementation choices for Dehla Pakad

- **Observation encoding**: A flat vector (~250–350 dims). Includes one-hot encoding of your hand (52 dims), cards already played by each player (52 × 4 = 208), trump suit (4), current trick state, score state, position info.
- **Action space**: Discrete(52) — one slot per card. Action masking forces the network to only pick legal cards by setting illegal action logits to `-infinity` before the softmax. This is critical and gets implemented inside the policy.
- **Reward shaping**: Sparse (+1 win, -1 loss) won't work well early. You shape it: small positive for capturing each 10, larger bonus for game win, big bonus for Kot, small negative for losing a 10. You'll iterate on these values.
- **Algorithm**: Start with **PPO with self-play** (simpler), graduate to **MAPPO** (one shared critic that sees the full state during training, decentralized actors at execution). MAPPO is the current standard for cooperative multi-agent settings.
- **Self-play structure**: All 4 seats use the same policy network during early training. Later, you keep a "league" of past versions and train against them to prevent overfitting to current self.

---

## Part 2 — The Complete Learning Checklist

I've organized this by area. You don't learn it all upfront — the phased plan in Part 3 tells you what to learn *when*.

### A. Python & numerical computing prerequisites
- Comfortable Python (classes, decorators, type hints, generators)
- **NumPy** — vectorized operations, broadcasting, array indexing, reshaping
- Basic data structures performance (when to use list vs dict vs set vs deque)
- Virtual environments (venv or conda) and dependency management
- Git basics for version control

### B. Deep learning fundamentals
- Tensors, autograd, computation graphs
- **PyTorch basics**: `nn.Module`, `optim`, training loops, `.to(device)`, `.detach()`
- Feedforward networks: linear layers, activations (ReLU, Tanh), softmax
- Loss functions: cross-entropy, MSE
- Optimizers: SGD, Adam (you mostly just use Adam)
- Batching, mini-batch training
- Overfitting, regularization basics
- GPU vs CPU — knowing when each helps

### C. RL theoretical foundations
- **Markov Decision Process (MDP)**: states, actions, transition function, reward function
- **POMDP** (Partially Observable MDP) — what Dehla Pakad actually is
- **Policy** (π): mapping from state to action, deterministic vs stochastic
- **Return**: cumulative discounted reward
- **Discount factor (γ)**: why it exists, how it shapes long-term planning (this is your "10-protection" learning mechanism)
- **Value function V(s)** and **action-value function Q(s,a)**
- **Bellman equation** — the recursive structure that all RL algorithms rely on
- **Exploration vs exploitation**: ε-greedy, entropy bonuses
- **On-policy vs off-policy** learning
- **Episode, trajectory, rollout** terminology

### D. RL algorithms (in order of conceptual progression)
- Multi-armed bandits (warm-up; not strictly needed but builds intuition)
- **Tabular Q-learning** — understand it deeply, even though you won't use it for Dehla Pakad
- **Deep Q-Networks (DQN)**: experience replay, target networks
- **Policy gradient theorem** (don't memorize the math, understand the intuition)
- **REINFORCE** — simplest policy gradient
- **Actor-Critic** methods
- **Advantage estimation**, **GAE (Generalized Advantage Estimation)**
- **PPO (Proximal Policy Optimization)**: clipped surrogate objective, why clipping helps
- **Entropy regularization** for exploration

### E. Multi-agent RL
- **Independent learning** vs **centralized training**
- **CTDE (Centralized Training, Decentralized Execution)** — the dominant paradigm
- **Self-play** dynamics and pitfalls (cycling strategies, opponent forgetting)
- **League-based training** / opponent pools
- **Credit assignment problem** — who in the team caused the win?
- **MAPPO** — how it differs from single-agent PPO
- Cooperative vs competitive vs mixed reward structures

### F. Imperfect-information game concepts
- **Information sets** — states that look identical to a player
- **Belief representation** — your bot's "guess" about hidden cards
- Why naive RL works "okay" but not optimally for imperfect info (briefly understand limitations)
- Awareness of **CFR (Counterfactual Regret Minimization)** — you don't need to implement it, but know it exists as the alternative paradigm used in poker bots

### G. Environment & engineering skills
- **Gymnasium API**: `reset`, `step`, `observation_space`, `action_space`
- **PettingZoo AEC API**: turn-based multi-agent interface
- **Action masking** implementation patterns
- **Vectorized environments** for parallel rollouts
- **Observation/action space design** for cards
- **Reward shaping** principles and pitfalls (reward hacking)

### H. Training infrastructure
- **TensorBoard** or **Weights & Biases** for logging
- Tracking: episode return, policy loss, value loss, entropy, KL divergence, win rate
- Model **checkpointing** and resuming training
- **Evaluation pipelines** — separate from training
- **Hyperparameter tuning**: learning rate, γ, GAE-λ, clip ratio, batch size, rollout length
- **Seeding and reproducibility**
- Reading and interpreting **learning curves**

### I. Debugging RL (this is its own skill)
- Sanity tests: does a random agent and a slightly-better-than-random agent show measurably different reward?
- Smoke tests on tiny problems (a 2-card mini version of your game)
- Common failure modes: reward not being received correctly, action mask leaking, observation not normalized, gradient explosion
- Why your loss going down doesn't mean your agent is improving (and vice versa)

---

## Part 3 — Phased Build & Learn Plan

Each phase has: **what you learn**, **what you build**, **how you test it**. Don't skip the testing — RL bugs are silent and brutal, and small undetected issues compound into a non-learning agent.

### Phase 0 — Setup (1–2 days)
**Learn:** Set up a clean Python environment (Python 3.11+), install PyTorch with the right CUDA/CPU build for your laptop, install Gymnasium and PettingZoo. Get familiar with running scripts and Jupyter.
**Build:** Run a "hello world" with `gymnasium.make("CartPole-v1")` using a random policy. Just confirm everything is wired up.
**Test:** You see a reward number printed. That's it.

### Phase 1 — RL conceptual foundation (4–6 days)
**Learn:** Sections C and D above, up through DQN. The single best free resource is the **Hugging Face Deep RL Course** (it's hands-on). Supplement with Sutton & Barto's textbook chapters 1–6 if you like reading, or David Silver's lecture series on YouTube if you prefer video.
**Build:** Train a tabular Q-learning agent on FrozenLake (Gymnasium). Then train a DQN on CartPole using Stable-Baselines3 — not from scratch, just to see the API.
**Test:** Your CartPole agent reaches reward 200+ consistently. If not, you don't move on — something fundamental is off.

### Phase 2 — Build the Dehla Pakad game engine (4–7 days)
**Learn:** Nothing new RL-wise. Pure software engineering. Just internalize the rules of Dehla Pakad precisely (write them down — corner cases around trump usage, last trick, capturing the 10s, Kot conditions).
**Build:** A pure Python `DehlaPakadGame` class. Dealing, trump selection, trick-taking, legal-move computation, scoring, terminal condition. No neural networks anywhere.
**Test:** Write unit tests. Simulate 10,000 random-vs-random games. Verify: total tricks per hand = 13, every game terminates, win/loss counts roughly even between teams 0 and 1, the four 10s are always accounted for somewhere.

This phase is the most underrated. A buggy game engine will make your bot "learn" nonsense and you'll spend weeks blaming RL.

### Phase 3 — Wrap as a PettingZoo environment (3–5 days)
**Learn:** PettingZoo AEC API documentation. The action masking pattern. Observation encoding choices for card games.
**Build:** A `DehlaPakadEnv` class subclassing PettingZoo's AEC interface. Implement `observe()` to return your encoded observation vector + the action mask, and `step()` to call your game engine. Decide your full observation schema and document it.
**Test:** PettingZoo provides a built-in API conformance test — run it. Then run 4 random agents through 1000 games via the env wrapper and confirm scores match your Phase 2 standalone numbers exactly.

### Phase 4 — Heuristic baseline (2–3 days)
**Learn:** Nothing new. This is product/strategy thinking.
**Build:** A scripted bot with simple rules: follow suit if possible, play lowest card when losing the trick is fine, play highest when you're winning the trick, hoard the 10 if not yet safe. No ML.
**Test:** Heuristic vs random — your heuristic should win clearly (>65% of hands). This is your **floor**. Any RL bot you train must eventually beat this baseline. Without this comparison point, you have no idea if your RL is working.

### Phase 5 — Single-agent PPO baseline (5–8 days)
**Learn:** PPO in depth. Read the **CleanRL PPO implementation** line by line — it's about 400 lines and is the best educational resource for understanding PPO. Learn how action masking integrates into a categorical policy.
**Build:** Treat the problem as single-agent for now: train one PPO agent in seat 0, fix the other three seats to your heuristic from Phase 4. This is much simpler than full multi-agent and isolates whether your RL pipeline works at all.
**Test:** Your PPO agent should beat the heuristic when it plays seat 0 within a few hundred thousand timesteps. Watch the learning curve in TensorBoard. If it doesn't improve, debug here — don't add multi-agent complexity on top of a broken pipeline.

### Phase 6 — Self-play (4–6 days)
**Learn:** Self-play dynamics, opponent pool / league concepts, evaluation against held-out opponents.
**Build:** All four seats now use the *same* current policy. Train via self-play. Add periodic evaluation: every N updates, freeze the policy and play 1000 games against (a) the heuristic, (b) random, (c) a frozen earlier checkpoint of itself.
**Test:** Win rate against heuristic continues to climb. Win rate against random approaches near-100%. Win rate against past-self stays around 50% (means you're still progressing, not just oscillating).

### Phase 7 — MAPPO / true cooperative multi-agent (5–8 days)
**Learn:** CTDE, MAPPO specifics, why a centralized critic helps in cooperative settings. Either implement on top of your CleanRL-style code, or switch to RLlib's MAPPO if you want a faster path.
**Build:** Two policies — one shared between teammates of team A, one shared between teammates of team B (or just one shared globally with self-play). Critically, the critic during training sees the full game state (all hands) while actors only see their own observation. This is the centralized-training-decentralized-execution pattern.
**Test:** MAPPO bot should clearly outperform the Phase 6 self-play bot. Look for emergent partner behavior: leading low cards to set up the partner, "signaling" through card choice patterns.

### Phase 8 — Reward shaping iteration (3–5 days, can overlap with 7)
**Learn:** Reward hacking and Goodhart's law in RL. The principle: shape rewards toward intermediate objectives, but always weight the true objective (winning the hand) much higher.
**Build:** Experiment with: bonus for capturing 10s, penalty for losing 10s, bonus for "controlled" trumping (using trump efficiently), Kot bonuses. Run controlled comparisons.
**Test:** Each shaping change is an experiment. Use wandb to compare runs. Reject changes that improve intermediate metrics but reduce final win rate — that's reward hacking.

### Phase 9 — Trump selection sub-problem (3–4 days)
**Learn:** Hierarchical action spaces, or treating sub-decisions as separate agents.
**Build:** Either (a) a separate small network that, given the first 4 cards, outputs trump choice probabilities, trained jointly with the main agent, or (b) extend the main observation/action space to include a "trump selection turn" at episode start.
**Test:** Compare against fixed strategies (e.g., "always pick the suit with the most cards"). Your learned trump selection should be at least as good.

### Phase 10 — Optimization and polish (3–5 days)
**Learn:** Vectorized environments, hyperparameter tuning approaches (Bayesian optimization via Optuna, or just structured grid search).
**Build:** Run multiple environments in parallel via PettingZoo's parallel API to multiply throughput. Run a hyperparameter sweep on the most sensitive params (learning rate, entropy coefficient, GAE-λ, clip range).
**Test:** Final evaluation: tournament between your final bot, your heuristic, random, and intermediate checkpoints. Win rates and decisive metrics (Kot rate, 10-capture rate) should be clearly best for the final bot.

---

## Part 4 — Critical advice from people who've done this

A few things that will save you weeks:

**Build the simplest thing first, always.** You'll be tempted to start with MAPPO and full reward shaping. Don't. The pipeline being correct matters far more than the algorithm being fancy. A correct DQN beats a buggy MAPPO every time.

**Log everything from day one.** Set up Weights & Biases or TensorBoard before your first training run. Track win rate, mean episode reward, policy entropy, value loss, KL divergence, gradient norm. RL training looks like noise without good logging.

**Never trust a model you haven't evaluated against fixed opponents.** Self-play win rates are misleading because they're 50% by definition once converged. The real test is win rate against frozen baselines (random, heuristic, earlier checkpoints).

**A laptop is enough, but use it well.** A modern laptop CPU can run thousands of Dehla Pakad hands per minute if your environment is pure Python and vectorized. You probably don't need a GPU until Phase 7+. When you do, Google Colab's free tier is fine.

**Debugging RL is mostly debugging your environment.** When the agent isn't learning, 80% of the time it's an env bug (wrong reward, wrong observation, wrong action mask, wrong terminal flag). Check the environment first, the algorithm last.

---

## Recommended primary resources

- **Hugging Face Deep RL Course** — free, hands-on, covers PPO well
- **CleanRL** (github.com/vwxyzjn/cleanrl) — read the PPO and DQN single-file implementations
- **Sutton & Barto, *Reinforcement Learning: An Introduction*** — chapters 1–6 and 13 are gold
- **PettingZoo documentation** — read it cover-to-cover before Phase 3
- **Spinning Up in Deep RL** by OpenAI — older but still excellent for theory
- **The MAPPO paper** ("The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games") — read before Phase 7

When you're ready to start writing actual code, come back and we can begin with Phase 0 setup or jump into whichever phase you're at. I'd suggest tackling phases 0–2 in week one — those are mostly software engineering and give you a real foundation to build the RL parts on.