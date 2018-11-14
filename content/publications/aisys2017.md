---
pubtypes: ["abstract"]
projects: ["compgen"]
title: "Symphony: Leveraging Probabilistic Graphical Models to Schedule Tasks to Clusters of Heterogeneous Processors"
authors: "Subho S. Banerjee, Steve Lumetta, Zbigniew T. Kalbarczyk and Ravishankar K. Iyer"
venue: "AISys 2017 (Colocated with SOSP 2017)"
date: 2017-10-28
links:
  - name: PDF
    icon: far fa-file-pdf
    url: "https://github.com/LearningSys/sosp17/blob/master/papers/18%5CCameraReadySubmission%5Csymphony.pdf"
---

The diminishing returns from Moore's law and technology scaling have significantly driven the
deployment of a plethora of accelerators in large scale computing infrastructures. While the design
of such accelerators is being broadly addressed, the challenge of designing an intelligent scheduler
that achieves optimizes performance while abstracting low-level systems details for the
heterogeneous processing fabric from the programmer continues to be a major problem.  An important
application where the foregoing challenges come together is computational genomics, particularly the
``Variant-Calling and Genotyping Analysis''. The Symphony system designed and implemented at
Illinois (and the object of this paper) reduces this challenge to that of utilizing Bayesian
inference in probabilistic graphical models to tie together heterogeneous compute resources like
general purpose accelerators (e.g., GPUs, MICs), and custom designed application specific processors
(prototyped on FPGAs). We demonstrates the performance, resource-management, scaling, scheduling and
isolation properties of Symphony. Our evaluation shows that the use of Symphony improves overall
benchmark performance (on a single node) from 73 hours to under 45 minutes (88x and nearly 210x in
terms of performance-per-watt) for human genome datasets that are appropriate for clinical use.
