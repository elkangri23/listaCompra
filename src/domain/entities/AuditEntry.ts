import { v4 as uuidv4 } from 'uuid';

interface AuditEntryProps {
  id?: string;
  entityType: string;
  entityId: string;
  changeType: 'CREATE' | 'UPDATE' | 'DELETE';
  changedByUserId?: string;
  timestamp?: Date;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  changedFields?: string[];
}

export class AuditEntry {
  public readonly id: string;
  public readonly entityType: string;
  public readonly entityId: string;
  public readonly changeType: 'CREATE' | 'UPDATE' | 'DELETE';
  public readonly changedByUserId?: string;
  public readonly timestamp: Date;
  public readonly oldValue?: Record<string, any>;
  public readonly newValue?: Record<string, any>;
  public readonly changedFields?: string[];

  private constructor(props: AuditEntryProps) {
    this.id = props.id || uuidv4();
    this.entityType = props.entityType;
    this.entityId = props.entityId;
    this.changeType = props.changeType;
    this.timestamp = props.timestamp || new Date();

    if (props.changedByUserId) this.changedByUserId = props.changedByUserId;
    if (props.oldValue) this.oldValue = props.oldValue;
    if (props.newValue) this.newValue = props.newValue;
    if (props.changedFields) this.changedFields = props.changedFields;
  }

  public static create(props: AuditEntryProps): AuditEntry {
    return new AuditEntry(props);
  }

  public toJSON() {
    return {
      id: this.id,
      entityType: this.entityType,
      entityId: this.entityId,
      changeType: this.changeType,
      changedByUserId: this.changedByUserId,
      timestamp: this.timestamp.toISOString(),
      oldValue: this.oldValue,
      newValue: this.newValue,
      changedFields: this.changedFields,
    };
  }
}
