/**
 * Catalogue des permissions atomiques.
 * Les rôles ne sont jamais codés en dur ailleurs : un guard vérifie
 * uniquement la présence d'une clé de permission chez l'utilisateur.
 */
export const PERMISSIONS = {
  // Planning
  PLANNING_VIEW: 'planning:view',
  PLANNING_MOVE: 'planning:move',

  // Tickets
  TICKET_VIEW: 'ticket:view',
  TICKET_CREATE: 'ticket:create',
  TICKET_UPDATE: 'ticket:update',
  TICKET_ARCHIVE: 'ticket:archive',
  TICKET_ASSIGN: 'ticket:assign',

  // Événements
  EVENT_VIEW: 'event:view',
  EVENT_CREATE: 'event:create',
  EVENT_UPDATE: 'event:update',
  EVENT_ARCHIVE: 'event:archive',

  // Commentaires
  COMMENT_VIEW: 'comment:view',
  COMMENT_CREATE: 'comment:create',
  COMMENT_ARCHIVE: 'comment:archive',

  // Clients & objets
  CLIENT_VIEW: 'client:view',
  CLIENT_MANAGE: 'client:manage',
  PROJECT_OBJECT_VIEW: 'project_object:view',
  PROJECT_OBJECT_MANAGE: 'project_object:manage',

  // Organisation
  TEAM_VIEW: 'team:view',
  TEAM_MANAGE: 'team:manage',
  USER_VIEW: 'user:view',
  USER_MANAGE: 'user:manage',

  // Administration
  ROLE_MANAGE: 'role:manage',
  STATUS_MANAGE: 'status:manage',
  AUDIT_VIEW: 'audit:view',
  DATA_EXPORT: 'data:export',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  [PERMISSIONS.PLANNING_VIEW]: 'Consulter le planning',
  [PERMISSIONS.PLANNING_MOVE]: 'Déplacer / redimensionner dans le planning',
  [PERMISSIONS.TICKET_VIEW]: 'Consulter les tickets',
  [PERMISSIONS.TICKET_CREATE]: 'Créer des tickets',
  [PERMISSIONS.TICKET_UPDATE]: 'Modifier des tickets',
  [PERMISSIONS.TICKET_ARCHIVE]: 'Archiver des tickets',
  [PERMISSIONS.TICKET_ASSIGN]: 'Assigner des tickets',
  [PERMISSIONS.EVENT_VIEW]: 'Consulter les événements',
  [PERMISSIONS.EVENT_CREATE]: 'Créer des événements',
  [PERMISSIONS.EVENT_UPDATE]: 'Modifier des événements',
  [PERMISSIONS.EVENT_ARCHIVE]: 'Archiver des événements',
  [PERMISSIONS.COMMENT_VIEW]: 'Lire les commentaires',
  [PERMISSIONS.COMMENT_CREATE]: 'Écrire des commentaires',
  [PERMISSIONS.COMMENT_ARCHIVE]: 'Archiver des commentaires',
  [PERMISSIONS.CLIENT_VIEW]: 'Consulter les clients',
  [PERMISSIONS.CLIENT_MANAGE]: 'Gérer les clients',
  [PERMISSIONS.PROJECT_OBJECT_VIEW]: 'Consulter les objets',
  [PERMISSIONS.PROJECT_OBJECT_MANAGE]: 'Gérer les objets',
  [PERMISSIONS.TEAM_VIEW]: 'Consulter les équipes',
  [PERMISSIONS.TEAM_MANAGE]: 'Gérer les équipes',
  [PERMISSIONS.USER_VIEW]: 'Consulter les utilisateurs',
  [PERMISSIONS.USER_MANAGE]: 'Gérer les utilisateurs',
  [PERMISSIONS.ROLE_MANAGE]: 'Gérer les rôles et permissions',
  [PERMISSIONS.STATUS_MANAGE]: 'Gérer les statuts personnalisés',
  [PERMISSIONS.AUDIT_VIEW]: "Consulter le journal d'audit",
  [PERMISSIONS.DATA_EXPORT]: 'Exporter les données',
};

const READER: PermissionKey[] = [
  PERMISSIONS.PLANNING_VIEW,
  PERMISSIONS.TICKET_VIEW,
  PERMISSIONS.EVENT_VIEW,
  PERMISSIONS.COMMENT_VIEW,
  PERMISSIONS.CLIENT_VIEW,
  PERMISSIONS.PROJECT_OBJECT_VIEW,
  PERMISSIONS.TEAM_VIEW,
  PERMISSIONS.USER_VIEW,
];

const EDITOR: PermissionKey[] = [
  ...READER,
  PERMISSIONS.PLANNING_MOVE,
  PERMISSIONS.TICKET_CREATE,
  PERMISSIONS.TICKET_UPDATE,
  PERMISSIONS.TICKET_ARCHIVE,
  PERMISSIONS.TICKET_ASSIGN,
  PERMISSIONS.EVENT_CREATE,
  PERMISSIONS.EVENT_UPDATE,
  PERMISSIONS.EVENT_ARCHIVE,
  PERMISSIONS.COMMENT_CREATE,
];

const ADMIN: PermissionKey[] = Object.values(PERMISSIONS);

/** Rôles de départ (section 5 du brief) — extensibles depuis l'admin. */
export const DEFAULT_ROLES = [
  {
    key: 'reader',
    name: 'Lecteur',
    description: 'Consultation du planning et des tickets',
    permissions: READER,
  },
  {
    key: 'editor',
    name: 'Éditeur',
    description: 'Création et modification des tickets, événements et planning',
    permissions: EDITOR,
  },
  {
    key: 'admin',
    name: 'Administrateur',
    description: 'Accès complet, y compris administration et exports',
    permissions: ADMIN,
  },
] as const;
