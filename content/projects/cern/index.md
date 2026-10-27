+++
title = "Grid Security & Scientific Computing at CERN"
date = 2012-02-22
aliases = ["/projects/alien/", "/projects/nudy/"]
period = "2010–2012"
institution = "CERN"
institution_key = "cern"
description = "Zero-trust grid storage authorization for ALICE and correlated Monte Carlo sampling for neutron transport."
+++

Global high-energy and nuclear physics experiments at [CERN] rely on federated
computing grids managing petabytes of collision data alongside compute-intensive
Monte Carlo particle transport codes. From 2010 to 2012, my research at CERN
focused on verifiable security for worldwide distributed storage in the [ALICE]
experiment and fast exact sampling algorithms for nuclear simulations:

* *Zero-Trust Grid Storage Authorization & Delegation ([AliEn]):* Operating
  across 85+ WLCG sites, 30,000+ compute nodes, and 200 PB of storage, AliEn's
  original file access protocol trusted client-reported metadata and exposed
  storage elements to unauthorized alteration. We designed the **LFN Booking
  Table** for atomic transient-state tracking and storage-signed `xrootd`
  envelopes that cut credential size by up to 50% in AliEn `v2.18–v2.20`
  (*[ACAT 2011a][ACAT11_LFN]*), paired with X.509 proxy-certificate delegation
  and access control for grid web services and locality-aware pilot jobs
  (*[ACAT 2011b][ACAT11_AUTH]*).
* *Multidimensional Correlated Alias Sampling (NuDY):* To accelerate Monte Carlo
  simulations of accelerator-driven fission systems and nuclear fuel cycles over
  [ENDF] cross-section libraries, we built unified nuclear data-processing
  routines bridging high-energy cascade and low-energy neutron transport regimes
  and generalized Walker's constant-time O(1) alias method to correlated
  multidimensional probability distributions with nonzero covariance
  (*[ACAT 2012][ACAT12_RNG]*).

[CERN]: https://home.cern/
[ALICE]: https://home.cern/science/experiments/alice
[AliEn]: https://alien.cern.ch/
[ENDF]: https://www-nds.iaea.org/exfor/endf.htm
[ACAT11_LFN]: /publications/acat2011_lfn/
[ACAT11_AUTH]: /publications/acat2011_auth/
[ACAT12_RNG]: /publications/acat2012_rng/
