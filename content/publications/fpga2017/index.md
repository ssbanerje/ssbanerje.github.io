+++
pubtype = "abstract"
projects = ["learnedsystems"]
title = "ASAP: Accelerated Short Read Alignment on Programmable Hardware"
authors = "Subho S. Banerjee, Mohamed el-Hadedy, Jong B. Lim, Daniel Chen, Zbigniew T. Kalbarczyk, Deming Chen, and Ravishankar K. Iyer"
venue = "FPGA 2017"
date = 2017-02-25

[[links]]
  name = "DOI"
  icon = "ai ai-acmdl"
  url = "http://doi.acm.org/10.1145/3020078.3021796"
+++

The proliferation of high-throughput sequencing machines allows for the rapid generation of billions
of short nucleotide fragments in a short period. This massive amount of sequence data can quickly
overwhelm today's storage and compute infrastructure. This poster explores the use of hardware
acceleration to significantly improve the runtime of short-read alignment (SRA), a crucial step in
pre-processing sequenced genomes. It presents the design and implementation of ASAP, an accelerator
for computing Levenshtein distance (LD) in the context of the SRA problem. LD computation is a
prominent underlying mathematical kernel that is common to a large number of SRA tools (e.g., BLAST,
BWA, SNAP) and is responsible for 50-70% of their runtime. These algorithms mentioned above
calculate the exact value of LD between nucleotide strings but only use them to build a total
ordering (an ordered list) of the most likely point of origin in the genome. ASAP computes an
approximation of LD by encoding computation in propagation delay of circuit elements. This
approximation is calculated in an accelerated fashion in hardware and preserves the original total
ordering of LDs produced by the traditional algorithms. This computation is performed by
constructing circuits that comprise the recursive definition of the LD computation and measuring
propagation delay of a signal entering and leaving the circuit. Additionally, ASAP can explore large
portions of the search space (substrings of the strings being compared) within one clock cycle, and
ignore parts of the search space that does not contribute to an answer. Our design is implemented on
an Altera Stratix V FPGA in an IBM POWER8 system using the CAPI interface for cache coherence across
the CPU and FPGA. Our design is 200x faster (median measurement) than the equivalent C
implementation of the kernel running on the host processor and 2.2x faster for an end-to-end
alignment tool for 120-150bp short-read sequences.
