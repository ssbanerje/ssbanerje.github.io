---
pubtypes: ["abstract"]
projects: ["compgen"]
title: "IGen: The Illinois Genomics Execution Environment"
authors: "Subho S. Banerjee and Ravishankar K. Iyer"
venue: "Supercomputing 2015"
date: 2015-01-01
links:
  - name: Web
    icon: fa fa-globe
    url: "http://sc15.supercomputing.org/sites/all/themes/SC15images/src_poster/src_poster_pages/spost159.html"
---

There has been a great optimism for the usage of DNA sequence data in clinical practice, notably for
diagnostics and developing personalized treatments tailored to an individual’s genome. This poster,
presents a study of software tools used in identifying and characterizing mutations in a genome. We
present IGen, a runtime framework which executes this workflow as a data-flow graph over a
partitioned global address space. Preliminary results on the Blue Waters supercomputer show that
IGen is able to accelerate single node performance (alignment - 1.2x, variant calling - 9x), as well
as distribute the computation across several machines with near-linear scaling. Theoretical models
for performance of the entire workflow suggest that IGen will have a 3x improvement in runtime on a
single node with near linear scaling across multiple nodes.
