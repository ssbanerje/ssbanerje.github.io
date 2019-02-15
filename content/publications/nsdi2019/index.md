+++
pubtypes = ["paper", "featured"]
projects = ["tds"]
title = "CAUDIT: Continuous Auditing of SSH-Servers To Mitigate Brute-Force Attacks"
authors = "Phuong Cao, Yuming Wu, and Subho Banerjee, Alex Withers and Justin Azoff, Zbigniew Kalbarczyk and Ravishankar Iyer"
venue = "NSDI 2019"
date = 2019-02-26

[[links]]
  name = "DOI"
  icon = "ai ai-doi"
  url = "https://www.usenix.org/conference/nsdi19/presentation/cao"
+++

This paper describes CAUDIT, an operational system deployed at the National Center for
Supercomputing Applications (NCSA) at the University of Illinois. CAUDIT is a fully
automated system to enable the identification and exclusion of hosts that are vulnerable
to SSH brute-force attacks. Its key features includes: 1) a honeypot for attracting
SSH-based attacks over a /16 IP address range and extracting key-metadata (e.g., source
IP, password, SSH-client version, or -key) from these attacks; 2) executing audits on the
live production network by replaying attack attempts recorded by the honeypot; 3) using
the IP addresses recorded by the honeypot to block SSH attack attempts at the network
border using a Black Hole Router (BHR) while significantly reducing the load on NCSA's
security monitoring system; and 4) informing peer sites of attack attempts in real-time
to ensure containment of coordinated attacks. The system is composed of existing techniques
with custom-built components, and its novelty is to execute at a scale that has not been
validated earlier (thousands of nodes and tens of millions of attack attempts per day).
Experience over 463 days shows that CAUDIT successfully blocks an average of 57 million
attack attempts on a daily basis using the proposed BHR. This represents a 66× reduction
in the number of SSH attempts compared to the daily average and has reduced 78% of the
traffic to the NCSA internal network-security-monitoring infrastructure.
