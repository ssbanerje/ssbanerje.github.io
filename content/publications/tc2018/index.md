+++
pubtypes = ["paper", "featured"]
projects = ["compgen"]
title = "ASAP: Accelerated Short Read Alignment on Programmable Hardware"
authors = "Subho S. Banerjee, Mohamed el-Hadedy, Jong B. Lim, Steve Lumetta, Zbigniew T. Kalbarczyk, Deming Chen and Ravishankar K. Iyer"
venue = "IEEE Transactions on Computers"
date = 2018-11-10

[[links]]
  name = "DOI"
  icon = "ai ai-ieee"
  url = "https://ieeexplore.ieee.org/document/8490591"
[[links]]
  name = "arXiv"
  icon = "ai ai-arxiv"
  url = "https://arxiv.org/abs/1803.02657"
+++

The proliferation of high-throughput sequencing machines ensures rapid generation of up to billions
of short nucleotide fragments in a short period of time. This massive amount of sequence data can
quickly overwhelm today's storage and compute infrastructure. This paper explores the use of
hardware acceleration to significantly improve the runtime of short-read alignment, a crucial step
in preprocessing sequenced genomes. We focus on the Levenshtein distance (edit-distance) computation
kernel and propose the ASAP accelerator, which utilizes the intrinsic delay of circuits for
edit-distance computation elements as a proxy for computation. Our design is implemented on an
Xilinx Virtex 7 FPGA in an IBM POWER8 system that uses the CAPI interface for cache coherence across
the CPU and FPGA. Our design is 200x faster than an equivalent Smith-Waterman-C implementation of
the kernel running on the host processor, 40-60x faster than an equivalent Landau-Vishkin-C++
implementation of the kernel running on the IBM Power8 host processor, and 2x faster for an
end-to-end alignment tool for 120--150 base-pair short-read sequences. Further the design represents
a 3760x improvement over the CPU in performance/Watt terms.
