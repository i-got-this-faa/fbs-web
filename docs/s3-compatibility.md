# S3 Compatibility: fbs-core vs AWS S3

## Overview

fbs-core is a minimal S3-compatible storage server intended for local and
small-scale use. It implements the core S3 data-plane operations needed for
standard object storage workflows but omits most of AWS's control-plane,
security, and scale-out features.

## Implemented S3 Features

| Feature | Notes |
|---|---|
| ListBuckets | |
| CreateBucket / HeadBucket / DeleteBucket | Delete on empty buckets only |
| GetBucketLocation | Config-defined single region |
| ListObjectsV1 / V2 | Prefix, delimiter, start-after, max-keys |
| PutObject / GetObject / HeadObject / DeleteObject | |
| DeleteObjects (multi-delete) | |
| CopyObject | |
| Multipart upload | Initiate, upload parts, complete, abort, list parts |
| SigV4 header auth | |
| SigV4 query-string auth | |
| Presigned GET URLs (public read) | Via management API; requires signing secret to be configured |
| ETags | |

## Not Implemented

| Category | Feature |
|---|---|
| Access control | ACLs (`?acl`) |
| Access control | Bucket policies (`?policy`) |
| Access control | CORS configuration endpoints (`?cors`) |
| Data management | Versioning (`?versions`) |
| Data management | Object tags (`?tagging`) |
| Data management | Lifecycle policies |
| Data management | S3 Object Lock (WORM) |
| Data management | S3 Inventory |
| Data management | S3 Select (SQL over objects) |
| Data management | Batch operations |
| Replication | CRR / SRR |
| Encryption | SSE-S3, SSE-KMS, SSE-C |
| Notifications | SNS / SQS / Lambda event notifications |
| Website hosting | Static website config (`?website`) |
| Auth / STS | Security Token Service (AssumeRole, GetSessionToken) |
| Auth / STS | Web identity federation |
| Advanced features | Transfer Acceleration |
| Advanced features | S3 Object Lambda |
| Advanced features | Multi-Region Access Points |
| Advanced features | S3 Access Points |
| Advanced features | Requester Pays |
| Advanced features | Request route / Outposts |

## Key Architectural Differences

### Storage Model

**AWS S3** is a globally distributed, multi-region object store that
replicates data across multiple availability zones with 11 9s of durability.
Objects are addressed by URL, stored in a flat namespace per bucket, and
backed by a custom distributed filesystem (no POSIX).

**fbs-core** stores every object as an ordinary file on a single machine's
disk under a configurable `data/` directory. Object keys are hashed to
UUID-based paths to avoid path-length issues and races during overwrite.
There is no replication — everything lives on one disk.

### Consistency

**AWS S3** provides:
- Read-after-write strong consistency for PUTs of *new* objects
- Eventual consistency for overwrite PUTs and DELETEs (this changed in late
  2020 for most regions — many operations are now strongly consistent)

**fbs-core** is **strongly consistent** for all operations — SQLite is the
source of truth, and the write path uses an atomic rename + metadata upsert
pattern. Reads see committed data immediately.

### Auth & Access Control

**AWS S3** uses IAM policies attached to users, groups, roles, and
resource-based bucket policies. Access is governed by statements with
`Effect`, `Action`, `Resource`, and `Condition` blocks. STS provides
temporary credentials via AssumeRole, web identity, or SAML federation.

**fbs-core** uses a two-tier role system (`admin` / `member`) with a
bucket ownership check:

| Role | Management API | S3 buckets |
|---|---|---|
| `admin` | Full access | All buckets |
| `member` | No access | Owned buckets only |

Bearer tokens (`fbsa_...`) are an fbs-core extension — AWS S3 only
supports SigV4 (plus STS session tokens).

### Encryption

AWS S3 provides server-side encryption options (SSE-S3, SSE-KMS, SSE-C)
and client-side encryption. fbs-core stores bytes as-is on disk — whatever
the filesystem provides is what you get.

### Operational Model

| | AWS S3 | fbs-core |
|---|---|---|
| Dependencies | DynamoDB, KMS, load balancers, edge locations | A single Go binary + SQLite + a data directory |
| Scaling | Multi-region, auto-scaling | Single node |
| Billing | Per-request, per-byte-metered | None |
| Metadata | Internal distributed KV store | SQLite with optional in-memory LRU cache |
| Regions | Global region/az model | Single config string |
| Durability | 11 nines | Filesystem-dependent |

## Design Intent

fbs-core is not trying to be a full S3 replacement. From the docs:

> fbs-core is a Go HTTP service built around a small set of internal
> packages. [...] Management routes are protected by authentication and
> then by `admin` role authorization.

The scope is focused on S3 data-plane operations (bucket and object CRUD,
multipart, listing, copy) with a lightweight management dashboard. The
control-plane features — policies, versioning, replication, encryption,
notifications — are absent by design.

## When to Pick fbs-core Over AWS S3

- Local development / testing where you want real S3 API semantics without
  cloud dependencies
- Small-scale internal storage (single team, single machine)
- Air-gapped or offline environments
- Learning / experimenting with S3 API patterns
- CI pipelines where spinning up MinIO is overkill

## When AWS S3 Is the Right Choice

- Production workloads needing durability, replication, and scale
- Multi-region or multi-tenant scenarios
- Compliance requirements (encryption, object lock, audit logging)
- Any need for the advanced features listed above
