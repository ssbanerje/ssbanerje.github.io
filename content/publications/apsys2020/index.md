+++
pubtype = "workshop"
projects = ["compgen"]
title = "Machine Learning for Load Balancing in the Linux Kernel"
authors = "Jingde Chen, Subho S. Banerjee, Zbigniew T. Kalbarczyk, and Ravishankar K. Iyer"
venue = "ApSys 2020"
date = 2020-08-24

[[links]]
  name = "DOI"
  icon = "ai ai-acmdl"
  url = "#"

[[links]]
  name = "Code (Kernel)"
  icon = "fas fa-code"
  url = "https://github.com/keitokuch/linux-4.15-lb"

[[links]]
  name = "Code (ML)"
  icon = "fas fa-code"
  url = "https://github.com/keitokuch/MLLB"
+++

The OS load balancing algorithm governs the performance gains provided by a multi-core computer
system. The Linux scheduler tracks process loads by average CPU utilization to balance workload
between processor cores. This approach maximizes the utilization of processing time but overlooks
the contention for lower-level hardware resources. In servers running compute-intensive work-loads,
an imbalanced need for limited computing resources hinders execution performance. This paper solves
the above problem using a machine learning (ML)-based resource-aware load balancer in Linux’s
Completely Fair Scheduler (CFS). We describe (1) a low-overhead methods to collect training data; (2)
an ML-model based on a multi-layer perceptron (MLP) model to imitate the CFS load balancer based on
the collected training data; and (3) an in-kernel implementation of inference on the model. Our
experiments demonstrate that the proposed model has an accuracy of 99.9% in making migration
decisions and only increases the latency of the load balance procedure by 13% (14.5μs to 16.4μs)

