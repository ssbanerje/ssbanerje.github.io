+++
featured = false
pubtype = "workshop"
projects = ["learnedsystems"]
title = "Is Function-as-a-Service a Good Fit for Latency-Critical Services?"
authors = "Haoran Qiu, Saurabh Jha, Subho S. Banerjee, Archit Patke, Chen Wang, Hubertus Franke, Zbigniew T. Kalbarczyk, and Ravishankar K. Iyer"
venue = "WoSC 2021 (Colocated with Middleware 2021)"
date = 2021-12-06
+++

Function-as-a-Service (FaaS) is becoming an increasingly popular cloud-deployment paradigm for serverless computing that
frees application developers from managing the infrastructure. At the same time, it allows cloud providers to assert
control in workload consolidation, i.e., co-locating multiple containers on the same server, thereby achieving higher
server utilization, often at the cost of higher end-to-end function request latency. Interestingly, a key aspect of
serverless latency management has not been well studied: the trade-off between application developers’ latency goals and
the FaaS providers’ utilization goals. This paper presents a multi-faceted, measurement-driven study of latency
variation in serverless platforms that elucidates this trade-off space. We obtained production measurements by executing
FaaS benchmarks on IBM Cloud and a private cloud to study the impact of workload consolidation, queuing delay, and cold
starts on the end-to-end function request latency. We draw several conclusions. For example, increasing a container’s
allocated memory limit from 128 MB to 256 MB reduces the tail latency by 2x but has 1.75x higher power consumption and
59% lower CPU utilization.
