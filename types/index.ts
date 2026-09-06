/**
 * Core type definitions for Syncora.
 */

export type EntityId = string;

export type Nullable<T> = T | null;

export interface BaseEntity {
  id: EntityId;
  createdAt: Date | string;
  updatedAt: Date | string;
}
