---
pubtypes: ["paper"]
title: "Enhancing the AliEn Web Service Authentication"
authors: "Jianlin Zhu, Pablo Saiz, Federico Carminati, Latchezar Betev, Daicui Zhou, Patricia M. Lorenzo, Alina G. Grigoras, Costin Grigoras, Fabrizio Furano, Steffen Schreiner, Olga V. Datskova, Subho S. Banerjee and Guoping Zhang"
venue: "Journal of Physics: Conference Series vol. 331 num. 6 p. 62048"
date: 2010-10-22
links:
  - name: Article
    icon: ai ai-open-access
    url: "http://stacks.iop.org/1742-6596/331/i=6/a=062048"
---

Web Services are an XML based technology that allow applications to communicate with each other across disparate
systems. Web Services are becoming the de facto standard that enable inter operability between heterogeneous processes
and systems. AliEn2 is a grid environment based on web services. The AliEn2 services can be divided in three categories:
Central services, deployed once per organization; Site services, deployed on each of the participating centers; Job
Agents running on the worker nodes automatically. A security model to protect these services is essential for the whole
system.

Current implementations of web server, such as Apache, are not suitable to be used within the grid environment. Apache
with the mod_ssl and OpenSSL only supports the X.509 certificates. But in the grid environment, the common credential is
the proxy certificate for the purpose of providing restricted proxy and delegation. An Authentication framework was
taken for AliEn2 web services to add the ability to accept X.509 certificates and proxy certificates from client-side to
Apache Web Server. The authentication framework could also allow the generation of access control policies to limit
access to the AliEn2 web services.
