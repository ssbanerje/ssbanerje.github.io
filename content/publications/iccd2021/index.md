+++
pubtype = "conference"
projects = ["learnedsystems"]
title = "Improved GPU Implementations of the Pair-HMM Forward Algorithm for DNA Sequence Alignment"
authors = "Enliang Li, Subho S. Banerjee, Sitao Huang, Ravishankar K. Iyer, Deming Chen"
venue = "ICCD 2021"
date = 2021-10-24
+++

With the rise of Next-Generation Sequencing (NGS) technology, clinical sequencing services become more accessible but
are also facing new challenges. The surging demand motivates developments of more efficient algorithms for computational
genomics and their hardware acceleration. In this work, we use GPU to accelerate the DNA variant calling and its related
alignment problem. The Pair-Hidden Markov Model (Pair-HMM) is one of the most popular and compute-intensive models used
in variant calling. As a critical part of the Pair-HMM, the forward algorithm is not only a computational but
data-intensive algorithm. Multiple previous works have been done in efforts to accelerate the computation of the forward
algorithm by the massive parallelization of the workload. In this paper, we bring advanced GPU implementations with
various optimizations, such as efficient host-device communication, task parallelization, pipelining, and memory
management, to tackle this challenging task. Our design has shown a speedup of 783x comparing to the Java baseline on
Intel single-core CPU, 31.88x to the C++ baseline on IBM Power8 multicore CPU, and 1.53x - 2.21x to the previous
state-of-the-art GPU implementations over various genomics datasets.

