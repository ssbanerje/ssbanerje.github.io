---
pubtype: paper
title: "On Accelerating Pair-HMM Computations in Programmable Hardware"
authors: "Subho S. Banerjee, Mohamed el-Hadedy, Ching Y. Tan, Zbigniew T. Kalbarczyk, Steve Lumetta and Ravishankar K. Iyer"
venue: "FPL 2017"
date: 2017-09-04
links:
  - name: To Appear
    icon: ai ai-ieee
    url: ""
  - name: Presentation
    icon: fa fa-file-pdf-o
    url: "files/FPL2017_Presentation.pdf"
---

This paper explores hardware acceleration to significantly improve the runtime of computing the forward algorithm on
Pair-HMM models, a crucial step in analyzing mutations in sequenced genomes. We describe 1) the design and evaluation of
a novel accelerator architecture that can efficiently process real sequence data without performing wasteful work; and
2) aggressive memoization techniques that can significantly reduce the number of invocations of, and the amount of data
transferred to the accelerator. We describe our demonstration of the design on a Xilinx Virtex 7 FPGA in an IBM Power8
system. Our design achieves a 14.85× higher throughput than an 8-core CPU baseline (that uses SIMD and multi-threading)
and a 147.49× improvement in throughput per unit of energy expended on the NA12878 sample.
