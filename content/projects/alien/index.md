+++
title = "AliEn: The ALICE Environment"
date = 2010-05-01
project = "alien"
description = "Authorization mechanisms for file operations on the WLCG using AliEn gird middleware."
concluded = "2010"
weight = 2
+++

The [AliEn project][alien] is a Grid middleware solution which offers transparent access to
distributed computing and storage resources all over the world and constitutes the primary
production environment for simulation, reconstruction, and analysis of physics data of the
[ALICE experiment][alice] at [CERN]. In 2010, AliEn was deployed on more than 85 sites all
over the world which contributed more than 30,000 compute nodes and 200PB of storage.

My work on the AliEn project involved (1) identifying vulnerabilities in the file access protocol,
and (2) implementing a user authorization mechanism to resolve the discovered vulnerabilities, and
(3) on _just in time_ job and data assignment using pilot jobs to intelligently make decisions of
job assignment based on data locality.  The result of this project was a more secure and revised
design, that complies with atomic and consistent transactions across distributed storage elements
and allows for accountable, authentic, and traceable file operations. These changes were
incorporated in versions `2.18`, `2.19` and `2.20` of AliEn.

[alien]: http://alien.web.cern.ch
[alice]: https://home.cern/science/experiments/alice
[cern]: https://home.cern/
