+++
title = "Intelligence-Augmented Computer Systems"
date = 2021-12-06
period = "2014–2021"
institution = "University of Illinois at Urbana-Champaign"
institution_key = "uiuc"
description = "Hybrid Bayesian–deep learning controllers and custom accelerators for managing heterogeneous computer systems."
projects_script = "ts/projects/learnedsystems.ts"
+++

Modern computer systems combine heterogeneous processors, accelerators, high-speed interconnects, and disaggregated storage, yet their resource managers still rely on handcrafted, average-case heuristics. Retuning those heuristics across platforms requires recurring expert effort. Purely black-box learning and optimization methods fit poorly here as well: they demand large training datasets, hide root causes when service-level objectives fail, and falter once control moves from coarse cluster schedulers into fast OS and hardware mechanisms. At microsecond-to-millisecond timescales, continuous fine-grained monitoring costs too much chip area and runtime overhead, so controllers must act on uncertain measurements and finish execution before workload phases shift. My [dissertation research][thesis2022] addressed system *complexity* and runtime *dynamics* through *architecture-guided* control: hybrid Bayesian–neural controllers encoded architectural domain knowledge as an inductive bias, and algorithm–hardware co-design met strict actuation deadlines through approximate software sampling and custom FPGA accelerators.

{{< toc.inline >}}{{ .Page.TableOfContents }}{{< /toc.inline >}}

## Architecture-Guided Control

Coarse cluster schedulers allocate static core counts and memory capacities without modeling contention in shared caches, memory channels, and device interconnects. This limitation surfaced directly in our distributed genomics workflows ([SC 2015][sc2015], [DIDC 2016][didc2016], [ECCB 2017][eccb2017]) and custom alignment and variant-calling accelerators ([FPGA 2017][fpga2017], [FPL 2017][fpl2017], [IEEE TC 2018][tc2018], [ICCD 2021][iccd2021]): once hardware acceleration shrank compute kernels, shared-memory and interconnect traffic across CPUs, GPUs, and FPGAs bottlenecked end-to-end throughput in ways domain scientists could not hand-tune. Scheduling these platforms is a sequential decision problem under partial observability. Hardware and software monitors expose only sparse, noisy views of shared resources, and every placement decision reshapes future contention.

Model-free learning and optimization methods struggle in this setting because they must infer hardware hierarchy and filter measurement noise directly from raw counters; consequently, they require long training trajectories and thrash across workload phase shifts. [Symphony][symphony] instead introduced an architecture-guided hybrid controller that wired platform topology directly into state estimation. A Bayesian graphical model mirrored the node's compute, memory, and interconnect hierarchy to fuse sparse telemetry through resource backpressure, and a compact neural policy scheduled tasks from the resulting posterior belief over latent bottlenecks.

PCIe interconnect contention in [Symphony][symphony] demonstrated why posterior uncertainty mattered (Figure 1). Because software cannot read internal PCIe switch load directly, the graphical model fused multiplexed endpoint telemetry into a posterior credible interval around the estimated load. Conditioning decisions on the full interval instead of the point mean solved two operational problems: structural consensus across neighboring monitors damped isolated counter spikes, and an elevated upper credible bound deferred DMA transfers before interconnect queues saturated. Because the state estimator already encoded system topology, the learned policy avoided rediscovering hardware structure online and used uncertainty bounds directly for admission control.

{{< viz id="ls-loop" >}}
Switch between control policies on a CPU/GPU/FPGA node sharing a PCIe interconnect. Under bursty DMA traffic, the upper credible bound crosses the DMA saturation threshold ahead of the posterior mean to trigger brief `No-Op` deferrals, whereas *Point Est.* admits transfers into queue stalls and *Black-Box* thrashes on counter noise.
{{< /viz >}}

## Other Examples

**Microservices.** Separating structural state estimation from compact policy learning applies directly to distributed application graphs. In cloud microservices ([FIRM][firm]) and consolidated serverless platforms ([WoSC 2021][wosc2021]), user requests traverse deep RPC call graphs that share compute, cache, memory, I/O, and network resources. Contention at one service inflates end-to-end tail latency even when mean CPU utilization stays low, so coarse autoscalers miss the offending instance. [FIRM][firm] traced critical request paths and per-instance latency variability to localize the services and contended resources driving SLO violations, and then used online learning to reprovision fine-grained partitions. Without searching across the entire call graph, the controller narrowed actuation to shared cache ways and memory bandwidth on the bottlenecked service alone (Figure 2).

{{< viz id="ls-firm" >}}
Click any RPC service node to inject contention and toggle `FIRM Loop: ON/OFF`. [FIRM][firm] isolates the bottlenecked instance on the critical path and repartitions only its shared cache ways, memory bandwidth, and CPU quota to hold P99 latency below the 100 ms SLO.
{{< /viz >}}

**Storage systems.** In disaggregated high-performance storage ([Kaleidoscope][kaleidoscope]), active-active High-Availability (HA) failover hides single-server crashes from passive client monitors, and shared storage fabrics mix hardware faults with transient I/O congestion. [Kaleidoscope][kaleidoscope] routed active I/O probes through a topology-aware Bayesian factor graph to detect silent HA failovers and isolate unhealthy targets; it then compared peer error logs and latency distributions to separate fail-stop hardware faults from fail-slow rebuild congestion. [CAUDIT][caudit] applied the same active-auditing principle to enterprise security, replaying honeypot-captured attack traffic across production hosts to find vulnerable machines invisible in passive border logs. When failover or network aggregation hides failures from passive monitors, lightweight active probes and a structural model recover component-level attribution.


**Linux kernel.** Inside the operating system kernel, execution budgets shrink to single-digit microseconds. Linux's Completely Fair Scheduler balances thread runqueues with coarse load averages that miss core and cache interference, yet hot migration paths forbid floating-point instructions without costly register saves. [ML-LB][mllb] fed low-overhead `eBPF` telemetry into a compact neural policy quantized to fixed-point integer arithmetic and completed scheduler migration checks in under two microseconds. At kernel and hardware timescales, both telemetry capture and model representation must fit the latency budget of the target path.

## Calibrated Telemetry

Fast low-level control is bounded by the physical cost of hardware and kernel monitoring. Continuous instrumentation across every microarchitectural structure or kernel path costs prohibitive silicon area, power, and CPU overhead; processors therefore multiplex hundreds of events onto a handful of physical counter registers, and OS profilers sample across time slices. Tools such as Linux `perf` rotate counter groups and scale counts linearly, which introduces severe estimation errors across bursty phases and OS interrupts. Downstream controllers cannot act reliably on such uncalibrated measurements.

[BayesPerf][bayesperf] formulated profiling itself as statistical inference. Individual multiplexed counters are noisy and incomplete, but related hardware and software events obey architectural conservation laws such as pipeline issue-slot accounting and cache-hierarchy miss balance. [BayesPerf][bayesperf] encoded these invariants in a Bayesian factor graph, overlapped counter groups across consecutive multiplexing windows, and reconstructed unmonitored events with calibrated uncertainty bounds at under 2% latency overhead. Correcting multiplexing bias at the counter layer spared higher-level controllers from learning around corrupted inputs.


## Algorithm–Hardware Co-Design

Running hybrid Bayesian–neural controllers inside OS, hardware, and [autonomous cyber-physical][av-proj] loops must bridge a two-order-of-magnitude timing mismatch: contention phases shift in microseconds to milliseconds, but exact Bayesian inference and gradient updates take tens to hundreds of milliseconds. In software, [Symphony][symphony] moved full inference off the online training path. For each queried resource, it expanded only the ancestor subgraph, pruned conditionally independent branches via Bayes-Ball reachability, and estimated parameter gradients from empirical frequency ratios over a small forward Monte Carlo batch. Batching these local updates across ready tasks cut tail scheduling latency by over an order of magnitude.

In hardware, [AcMC²][acmc2] compiled probabilistic programs into custom Markov-Chain Monte Carlo accelerators validated on Xilinx FPGA prototypes attached to host CPUs. The compiler exploited Markov-blanket independences to sample non-adjacent variables in parallel across pipelined random-number generators, and synthesized a speculative Metropolis–Hastings lookahead tree that committed chain transitions in one clock cycle to meet sub-millisecond inference budgets.

Together, calibrated profiling ([BayesPerf][bayesperf]), architecture-guided controllers ([Symphony][symphony], [FIRM][firm], [Kaleidoscope][kaleidoscope], [ML-LB][mllb]), and hardware-accelerated sampling ([AcMC²][acmc2]) formed a complete control stack across the OS and hardware: applications declared latency, throughput, and resilience goals while the runtime coordinated shared monitoring, probabilistic state estimation, and sub-millisecond actuation beneath them.

[av-proj]: /projects/av/
[thesis2022]: /publications/thesis2022/
[sc2015]: /publications/sc2015/
[didc2016]: /publications/didc2016/
[fpga2017]: /publications/fpga2017/
[eccb2017]: /publications/eccb2017/
[fpl2017]: /publications/fpl2017/
[tc2018]: /publications/tc2018/
[iccd2021]: /publications/iccd2021/
[symphony]: /publications/icml2020/
[firm]: /publications/osdi2020/
[wosc2021]: /publications/wosc2021/
[kaleidoscope]: /publications/sc2020/
[caudit]: /publications/nsdi2019/
[mllb]: /publications/apsys2020/
[bayesperf]: /publications/asplos2021/
[acmc2]: /publications/asplos2019/
