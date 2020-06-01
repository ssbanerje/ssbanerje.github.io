+++
pubtypes = ["paper"]
projects = ["alien"]
title = "Securing the AliEn File Catalogue - Enforcing authorization with accountable file operations"
authors = "Steffen Schreiner, Stefano Bagnasco, Subho S. Banerjee, Latchezar Betev, Federico Carminati, Olga V. Datskova, Fabrizio Furano, Alina Grigoras, Costin Grigoras, Patricia M. Lorenzo, Andreas J. Peters, Pablo Saiz, and Jianlin Zhu"
venue = "ACAT 2011"
date = 2011-10-22

[[links]]
  name = "DOI"
  icon = "ai ai-open-access"
  url = "http://stacks.iop.org/1742-6596/331/i=6/a=062044"
+++

The AliEn Grid Services, as operated by the ALICE Collaboration in its global physics analysis grid
framework, is based on a central File Catalogue together with a distributed set of storage systems
and the possibility to register links to external data resources. This paper describes several
identified vulnerabilities in the AliEn File Catalogue access protocol regarding fraud and
unauthorized file alteration and presents a more secure and revised design: a new mechanism, called
LFN Booking Table, is introduced in order to keep track of access authorization in the transient
state of files entering or leaving the File Catalogue. Due to a simplification of the original
Access Envelope mechanism for xrootd-protocol-based storage systems, fundamental computational
improvements of the mechanism were achieved as well as an up to 50% reduction of the credential's
size. By extending the access protocol with signed status messages from the underlying storage
system, the File Catalogue receives trusted information about a file's size and checksum and the
protocol is no longer dependent on client trust. Altogether, the revised design complies with atomic
and consistent transactions and allows for accountable, authentic, and traceable file operations.
This paper describes these changes as part and beyond the development of AliEn version 2.19.
