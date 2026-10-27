+++
title = "Silent Data Corruption"
date = 2026-07-07
period = "2021–2026"
institution = "Google"
institution_key = "google"
description = "Characterizing, detecting, and driving down silicon defects across CPUs, TPUs, GPUs, and NICs in Google's datacenters."
+++

Silicon manufacturing test escapes now exceed industrial targets by at least an
order of magnitude across modern process nodes, causing defective processors and
accelerators to silently corrupt application state without triggering hardware
faults. Bridging computer architecture research directly into production fleet
operations across CPUs, TPUs, GPUs, and NICs in Google's datacenters, my work
addresses defect-induced silent data corruption (SDC) end to end:

* *Fleet-Scale Defect Characterization & Diagnosis:* Our *[IEEE Design & Test][DT25]*
  work establishes rigorous fleet measurement methodologies that overcome the
  blind spots of prior industrial studies, quantifying silicon test escapes
  across datacenter fleets and rapidly diagnosing root causes directly from
  anomalous system and application behaviors.
* *Automated Intra-Thread Instruction Checking:* *[ITHICA]* (*MICRO 2026*)
  automatically transforms arbitrary programs, production datacenter workloads,
  and standard libraries into high-coverage functional defect screens without
  custom hardware. Exploiting the insight that the hardest-to-catch silicon
  defects manifest as execution-context-dependent inconsistent errors within a
  single thread, ITHICA detects 39% more defective servers across 3,000+ CPUs
  than baseline hyperscaler tests while pinpointing exact failing instructions.
* *Generation-on-Generation Silicon Quality Co-Design:* Partnering directly with
  silicon vendors, we feed fleet defect telemetry, localized instruction
  failure signatures, and high-coverage screening methodologies back into
  manufacturing test flows to drive down generation-on-generation defect escape
  rates across Google's fleet.

[DT25]: /publications/d_t2025/
[ITHICA]: /publications/micro2026/
