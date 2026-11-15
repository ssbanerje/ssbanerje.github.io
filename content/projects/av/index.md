+++
title = "Autonomous Vehicle Resilience"
date = 2020-06-30
period = "2017–2020"
institution = "University of Illinois at Urbana-Champaign"
institution_key = "uiuc"
description = "Causal Bayesian fault injection, field-data analytics, and adversarial testing for autonomous vehicles."
projects_script = "ts/projects/av.ts"
+++

High offline benchmark accuracy does not guarantee that an [intelligence-augmented computer system][ls-proj] will stay safe in closed loop under hardware faults, software bugs, or adversarial inputs. Autonomous vehicles put closed-loop dependability under strict physical deadlines, as neural perception, multi-object tracking, motion planning, and vehicle dynamics feed back into one another every control cycle. Across over 1.1 million miles of public road-test logs and experiments on production [NVIDIA Drive][drive] and [Baidu Apollo][apollo] platforms, our studies showed why passive road testing missed rare tail hazards and how active fault injection across the AV controller and hardware layers exposed them. The same Bayesian stopping-margin models that pinpointed crash-prone driving states also uncovered timing-targeted perception attacks and guided runtime defenses.

{{< toc.inline >}}{{ .Page.TableOfContents }}{{< /toc.inline >}}

## Field Failures in Road Testing

Offline model benchmarks and aggregate regulatory tallies do not show how failures propagate across deployed autonomous fleets. [LogDriver][logdriver] analyzed 1,116,605 autonomous driving miles, 5,328 disengagements, and 42 accidents across 144 vehicles from 12 manufacturers in California road-test filings. Optical character recognition and natural-language tagging mapped incident narratives onto a three-loop control model covering mechanical actuation, the AV controller, and human takeover in traffic. Among classifiable disengagements, 64% originated in the ML perception and planning pipeline, and nearly 34% stemmed from traditional computing-system faults including software freezes, watchdog timeouts, and delayed sensor localization.

Field logs also exposed a narrow physical takeover bound. Safety-driver reaction averaged 0.85 seconds after an alert and slowed measurably as fleets accumulated incident-free miles; collisions occurred whenever fault-detection latency plus human reaction exceeded the vehicle's braking window. Even past one million road miles, cumulative disengagements failed to plateau for any manufacturer, and tail variance across vehicles widened. Routine public-road drives hit tight safety margins too rarely to certify tail behavior, and human fallback drivers cannot rescue a fast control loop once braking distance runs out.

## Controller and Hardware Faults

Because passive road drives rarely visit those narrow physical margins, certifying tail behavior requires injecting faults directly into the running system. Faults can corrupt closed-loop execution at two levels: the AV controller connecting sensors to actuation, and the hardware layer executing its neural models.

**AV controller layer.** Open-loop perturbations to standalone neural networks or single camera frames cannot show whether vehicle inertia and control feedback mask a transient error or compound it across frames into a crash. [AVFI][avfi] coupled an AV controller with a 3D urban physics simulator in a 15 Hz closed loop to inject sensor corruptions (noise, occlusions, weather), compute and actuation bit-flips, neural weight perturbations, and inter-module timing faults (latency stalls, dropped frames, stale command replay). Measured by Violations and Accidents per Kilometer alongside Time to Traffic Violation, identical sensor corruptions vanished on open roads yet caused violations in tight traffic, and actuation delays of 0.67 to 2.0 seconds triggered tens of violations per kilometer. Inter-module IPC latency and stale messages can breach physical Time-to-Traffic-Violation budgets even when per-frame model accuracy remains high.

**Hardware layer.** At the hardware level, transient memory and datapath bit-flips span millions of 32-bit floating-point weights. Random bit-flipping and OS debugger hooks such as `ptrace` sample only a sliver of that fault space, fail on proprietary GPUs or neural accelerators without debug interfaces, and lack any stopping criterion. [BDLFI][bdlfi] modeled per-bit hardware upsets from architectural vulnerability factors as Bernoulli bitwise-XOR uncertainty inside a Bayesian neural network; Markov-Chain Monte Carlo inference then ran natively on standard ML accelerators until chain mixing guaranteed statistical convergence. Converged fault traversal on ResNet-18 refuted the monotonic layer-depth sensitivity reported by incomplete random campaigns and separated two regimes (Figure 1): a flat low-error plateau where misclassifications clustered near the decision boundary, and a sharp high-error knee driven by flips in high-order floating-point exponent bits. Differentiable Bayesian fault propagation gave architects accelerator-native evaluation with a provable stopping rule, justifying boundary-margin checks and selective exponent-bit protection over costly full-word ECC.

{{< viz id="av-bdlfi" >}}
Drag the *Test Input* marker across the classifier map or adjust the bit-error rate. Wide margins inside a class region absorb mantissa bit-flips, whereas inputs near the decision boundary flip easily and high-rate exponent bit-flips corrupt even confident predictions unless 8-bit exponent ECC is enabled.
{{< /viz >}}

## Bayesian Fault Injection

Scaling closed-loop injection from single components to a full multi-sensor autonomy stack breaks random sampling: 5,000 random AV-controller and GPU hardware-register injections into [NVIDIA Drive][drive] and [Baidu Apollo][apollo] produced zero safety hazards, and exhaustively simulating 41 module fault modes across one 2,400-scene scenario would take 615 simulator days. Wide braking margins, multi-rate camera and LiDAR Kalman fusion, and closed-loop PID control absorb over 98% of random errors. [DriveFI][drivefi] adapted the dynamic Bayesian graphical models used for state estimation in [intelligence-augmented computer systems][ls-proj] to score which driving states and module faults could breach safety margins. It combined a trace-learned temporal Bayesian network with a kinematic emergency-stop solver and performed counterfactual graph surgery offline to predict when a module fault pushed the vehicle into the crash zone.


Running 3D simulations only on predicted hazards uncovered 561 critical fault scenarios in under four hours (a 3,690× speedup over brute-force testing); 82% of those runs caused collisions or lane departures, concentrated in under 1% of driving scenes. Cross-stack comparison also showed why [NVIDIA Drive][drive] survived camera object-removal and lane faults that crashed [Baidu Apollo][apollo]: alongside primary object detection, Drive ran a lightweight, functionally diverse free-space network. Causal offline screening reduced multi-month simulation campaigns to hours and isolated both where architectural diversity prevented crashes and which narrow-margin states remained exposed.

## Adversarial Attacks and Defenses

The same narrow braking windows that expose an autonomy stack to accidental faults also create an opening for targeted sensor attacks. Untimed perception attacks fail for the same reasons random faults do: across 2,000 [Baidu Apollo][apollo] runs, random trajectory spoofing caused zero crashes, untimed hijacking crashed only 5.1% because wide braking margins allowed recovery, and abrupt bounding-box jumps tripped Hungarian association gates or Kalman residual checks. [RoboTack][robotack] turned stopping-margin estimation into a two-stage online attack over an unencrypted automotive Ethernet camera feed. Stage 1 ran a compact neural predictor and binary search to trigger within natural detector-dropout durations just before the braking point of no return, raising crash rates over 10× overall and up to 24× on pedestrians. Stage 2 shifted bounding boxes within one standard deviation of Gaussian detection jitter so the Kalman filter integrated fake lateral velocity without residual alarms. Because long-range LiDAR returns are sparse on small targets, pedestrians suffered an 84.1% crash rate compared with 31.7% for vehicles.


Standard safeguards such as CAN encryption, passive camera–LiDAR fusion, and fixed residual thresholds block random noise yet miss drift timed to the braking boundary. Hardening stateful ML controllers therefore requires three runtime mechanisms: authenticating raw high-bandwidth sensor links; tightening detection, association, and Kalman noise bounds dynamically as stopping margins shrink; and checking multi-frame directional bias across sensor ranges. Isolated frame accuracy cannot certify a live ML system: end-to-end resilience depends on bounding how errors accumulate across stateful filters within the vehicle's physical braking window.

[ls-proj]: /projects/learnedsystems/
[logdriver]: /publications/dsn2018/
[avfi]: /publications/dsn2018_avfi/
[bdlfi]: /publications/dsn2019_bdlfi/
[drivefi]: /publications/dsn2019/
[robotack]: /publications/dsn2020/
[drive]: https://developer.nvidia.com/drive
[apollo]: https://apollo.auto/
