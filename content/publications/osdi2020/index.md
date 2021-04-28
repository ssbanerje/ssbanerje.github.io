+++
featured = true
pubtype = "conference"
projects = ["learnedsystems"]
title = "FIRM: An Intelligent Fine-Grained Resource Management Framework for SLO-Oriented Microservices"
authors = "Haoran Qiu, Subho S. Banerjee, Saurabh Jha, Zbigniew T. Kalbarczyk, and Ravishankar K. Iyer"
venue = "OSDI 2020"
date = 2020-11-04

[[links]]
  name = "DOI"
  icon = "ai ai-doi"
  url = "https://www.usenix.org/conference/osdi20/presentation/qiu"

[[links]]
  name = "arXiv"
  icon = "ai ai-arxiv"
  url = "http://arxiv.org/abs/2008.08509"

[[links]]
  name = "Code"
  icon = "fas fa-code"
  url = "https://gitlab.engr.illinois.edu/DEPEND/firm"

[[links]]
  name = "Data"
  icon = "fas fa-database"
  url = "https://databank.illinois.edu/datasets/IDB-6738796"
+++

Modern user-facing, latency-sensitive web services include numerous distributed, intercommunicating
microservices that promise to simplify software development and operation. However, multiplexing
compute-resources across microservices is still challenging in production because contention for
shared resources can cause latency spikes that violate the service-level objectives (SLOs) of user
requests. This paper presents FIRM, an intelligent fine-grained resource management framework for
predictable sharing of resources across microservices to drive up overall utilization. FIRM
leverages online telemetry data and machine-learning methods to adaptively (a) detect/localize
microservices that cause SLO-violations, (b) identify low-level resources in contention, and (c)
take actions to mitigate SLO-violations by dynamic reprovisioning. Experiments across four
microservice benchmarks demonstrate that FIRM reduces SLO violations by up to 16x while reducing the
overall requested CPU limit by up to 62%. Moreover, FIRM improves performance predictability by
reducing tail latencies by up to 11x.
