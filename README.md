# MedSecure AI

**Medical Security in AI for Hospital Management Systems.**

MedSecure AI is a web application built around **SHIELD-IoHT**, a security framework for the Internet of Healthcare Things (IoHT/IoMT) in smart hospitals. Connected devices such as infusion pumps, bedside monitors and implantables enlarge the hospital attack surface. SHIELD-IoHT combines three techniques that are usually studied separately: federated intrusion detection, blockchain key management and differential privacy.

## Objectives

- Hospital devices are network endpoints, and most were not built to resist attack.
- Ransomware and intrusions turn an IT compromise into a failure of patient care.
- Centralising patient data to train a detector breaks privacy rules (HIPAA, GDPR) and creates a single point of failure.
- Each defence works alone. Few designs combine them into one deployable system.

## Framework Overview

SHIELD-IoHT has four layers (perception, edge, network, cloud) and three modules. A trust boundary separates the edge tier from the network layer: raw patient records and raw traffic stay inside it, and only clipped, noised model updates cross it.

| Module | What it does |
| --- | --- |
| **FIDM**: Federated Intrusion Detection | Hybrid 1D-CNN + BiLSTM trained locally on network traffic and physiological streams. Only parameter updates leave the hospital. Uses FedProx for non-IID clients. |
| **BKMM**: Blockchain Key Management | Permissioned Hyperledger Fabric network for device enrolment, session keys and revocation. A revoked device loses access across the deployment within one block interval. |
| **DPEM**: Differential Privacy Enforcement | Patient-level (ε, δ)-DP via per-patient gradient clipping, Gaussian noise, a Rényi DP accountant and secure aggregation. |
| **Ransomware Interdiction** | Second-stage gradient-boosted classifier, triggered only when FIDM flags a window. Aims to isolate the device segment and revoke keys before bulk encryption starts. |

**Closed loop:** a detection event triggers key revocation through BKMM, and the revoked device is denied re-association automatically.

## Threats Covered

| ID | Threat |
| --- | --- |
| T1 | Network intrusion (MITM, ARP spoofing, DoS) |
| T2 | Ransomware (access, lateral movement, encryption, extortion) |
| T3 | Identity attacks (session hijacking, credential theft, replay) |
| T4 | Data poisoning in federated aggregation |

## Tech Stack

- **Frontend:** Vite + TypeScript
- **Research and ML framework:** PyTorch, TensorFlow Privacy, scikit-learn
- **Ledger:** Hyperledger Fabric 2.5
- **Datasets:** TON_IoT, UNSW-NB15, custom Healthcare Monitoring Dataset (HMD)

## Project Structure

```
MedsecureAi/
├── src/            # application source
├── index.html      # app entry
├── vite.config.ts  # Vite config
├── tsconfig.json   # TypeScript config
├── package.json
└── .env            # local secrets (do not commit)
```

## Getting Started

```bash
git clone https://github.com/vrajshah1052-afk/MedsecureAi.git
cd MedsecureAi
npm install
cp .env.example .env   # add your own keys
npm run dev
```

Production build:

```bash
npm run build
```

## Reported Results (from the paper)

| Metric | Result |
| --- | --- |
| Macro-F1 on TON_IoT | 0.974 |
| Federated convergence | 47 rounds, within 1.3 pp of centralised training |
| Authentication latency | 38.4 ms per session |
| Detection accuracy at ε = 1.0 | 95.2% |
| Ransomware interdicted before bulk encryption | 89.3% of tested scenarios |

> **Status:** the ablation study, the full privacy-utility sweep and Raspberry Pi edge feasibility measurements are still in progress. The paper marks them as pending and does not estimate them.

## Roadmap

- [ ] Complete ablation: combined framework vs each module alone
- [ ] Privacy-utility sweep across ε values
- [ ] Edge feasibility on Raspberry Pi 4
- [ ] Release HMD dataset with generation scripts
- [ ] Explainability layer so clinicians can see why a device was isolated
- [ ] Differential privacy combined with Byzantine-robust aggregation
- [ ] Physical-layer anomaly analysis before authentication

## Authors

Vraj Shah, Ninad Wagh, Veer Jain, Sanchit Wagh, and Prof. Anup Ingle (faculty guide)
Vishwakarma Institute of Technology, Pune, India

## Citation

```
V. Shah, N. Wagh, V. Jain, S. Wagh, A. Ingle,
"Medical Security in AI: An Intelligent Cybersecurity and Blockchain-Based
Security Framework for Internet of Medical Things (IoMT) in Smart Hospitals,"
VIT Pune, 2026.
```
