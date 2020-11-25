+++
featured = true
pubtype = "conference"
projects = ["compgen"]
title = "Live Forensics for HPC Systems: A Case Study on Distributed Storage Systems"
authors = "Saurabh Jha, Shengkun Cui, Subho S. Banerjee, Tianyin Xu, Jeremy Enos, Mike Showerman, Zbigniew T. Kalbarczyk, and Ravishankar K. Iyer"
venue = "Supercomputing 2020"
date = 2020-11-15
award = ["Best Paper & Best Student Paper Finalist"]

[[links]]
  name = "DOI"
  icon = "ai ai-acmdl"
  url = "https://dl.acm.org/doi/10.5555/3433701.3433787"
[[links]]
  name = "Code"
  icon = "fas fa-code"
  url = "https://github.com/saurabhjha1/kscope-artifact"
+++

Large-scale high-performance computing systems frequently experience a wide range of failure modes,
such as reliability failures (e.g., hang or crash), and resource overload-related failures (e.g.,
congestion collapse), impacting systems and applications. Despite the adverse effects of these
failures, current systems do not provide methodologies for proactively detecting, localizing, and
diagnosing failures. We present Kaleidoscope, a near real-time failure detection and diagnosis
framework, consisting of of hierarchical domain-guided machine learning models that identify the
failing components, the corresponding failure mode, and point to the most likely cause indicative of
the failure in near real-time (within one minute of failure occurrence). Kaleidoscope has been
deployed on Blue Waters supercomputer and evaluated with more than two years of production telemetry
data. Our evaluation shows that Kaleidoscope successfully localized 99.3% and pinpointed the root
causes of 95.8% of 843 real-world production issues, with less than 0.01% runtime overhead.

