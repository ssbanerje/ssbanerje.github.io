+++
pubtype = "workshop"
projects = ["compgen"]
title = "Efficient and Scalable Workflows for Genomic Analyses"
authors = "Subho S. Banerjee, Arjun P. Athreya, Liudmila S. Mainzer, C. Victor Jongeneel, and Wen-Mei Hwu, Zbigniew T. Kalbarczyk, and Ravishankar K. Iyer"
venue = "DIDC 2016 (Colocated with HPDC 2016)"
date = 2016-05-31

[[links]]
  name = "DOI"
  icon = "ai ai-acmdl"
  url = "http://dl.acm.org/citation.cfm?id=2912156"
+++

Recent growth in the volume of DNA sequence data and associated computational costs of extracting
meaningful information warrants the need for efficient computational systems at-scale. In this work,
we propose the Illinois Genomics Execution Environment (IGen), a framework for efficient and
scalable genome analyses. The design philosophy of IGen is based on algorithmic analysis and
extensive measurements on compute- and data-intensive genomic analyses workflows (such as variant
discovery and genotyping analysis) executed on high-performance and cloud computing infrastructures.
IGen leverages the advantages of existing designs and proposes new software improvements to overcome
the inefficiencies we observe in our measurements. Based on these composite improvements, we
demonstrate that IGen is able to accelerate the alignment from 13.1 hours to 10.8 hours (1.2x) and
the variant from 10.1 hours to 1.25 hours (8x) calling on a single node, and its modular design
scales efficiently in a parallel computing environment.
