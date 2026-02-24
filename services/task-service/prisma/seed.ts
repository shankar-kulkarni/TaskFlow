import { PrismaClient } from '@prisma/client';
import type { Group, Project, Task, User } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

const resetTaskEmbeddings = async () => {
  try {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE task_embeddings`);
    console.log('✅ Cleared existing task embeddings');
  } catch {
    // Backward-compatible when task_embeddings table has not been created yet.
    console.log('ℹ️ task_embeddings table not available; skipping clear');
  }
};

const setTenantWebPortalUrl = async (tenantId: string, url: string) => {
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "tenants" SET "web_portal_url" = $1 WHERE "id" = $2`,
      url,
      tenantId,
    );
  } catch {
    // Backward-compatible when migration has not been applied yet.
  }
};

const setTenantTimezone = async (tenantId: string, timezone: string) => {
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "tenants" SET "timezone" = $1 WHERE "id" = $2`,
      timezone,
      tenantId,
    );
  } catch {
    // Backward-compatible when migration has not been applied yet.
  }
};

async function main() {
  await resetTaskEmbeddings();

  // Create a tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: 'saas-test' },
    update: {},
    create: {
      id: 'saas-test',
      name: 'Default Tenant',
    },
  });
  await setTenantWebPortalUrl(tenant.id, 'http://localhost:5175');
  await setTenantTimezone(tenant.id, 'UTC');

  const passwordHash = await bcryptjs.hash('Password123!', 12);

  const assignUsersToTasks = async (items: Task[], userIds: string[], assignedBy: string) => {
    if (items.length === 0 || userIds.length === 0) return;
    const assignments = items.map((task, index) => {
      const userId = userIds[index % userIds.length];
      return { taskId: task.id, userId, assignedBy };
    });
    await prisma.taskUserAssignment.createMany({ data: assignments, skipDuplicates: true });
  };

  const upsertUser = async (input: {
    id: string;
    tenantId: string;
    email: string;
    displayName: string;
    role?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'GUEST';
  }) => {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ id: input.id }, { email: input.email }]
      }
    });

    if (existing) {
      return prisma.user.update({
        where: { id: existing.id },
        data: {
          tenantId: input.tenantId,
          email: input.email,
          displayName: input.displayName,
          role: input.role || 'MEMBER',
          passwordHash,
          emailVerified: true
        }
      });
    }

    return prisma.user.create({
      data: {
        id: input.id,
        tenantId: input.tenantId,
        email: input.email,
        displayName: input.displayName,
        role: input.role || 'MEMBER',
        passwordHash,
        emailVerified: true
      }
    });
  };

  // Create users by role (tenant-scoped)
  const users: User[] = [];
  const seedUsers = [
    { id: 'user-owner', email: 'owner@example.com', displayName: 'Workspace Owner', role: 'OWNER' as const },
    { id: 'user-admin', email: 'admin@example.com', displayName: 'Workspace Admin', role: 'ADMIN' as const },
    { id: 'user-member', email: 'member@example.com', displayName: 'Workspace Member', role: 'MEMBER' as const },
    { id: 'user-viewer', email: 'viewer@example.com', displayName: 'Workspace Viewer', role: 'VIEWER' as const },
    { id: 'user-guest', email: 'guest@example.com', displayName: 'Workspace Guest', role: 'GUEST' as const },
    { id: 'user-superadmin', email: 'superadmin@taskflow.local', displayName: 'Platform SuperAdmin', role: 'OWNER' as const },
  ];
  for (const seedUser of seedUsers) {
    const user = await upsertUser({
      id: seedUser.id,
      tenantId: tenant.id,
      email: seedUser.email,
      displayName: seedUser.displayName,
      role: seedUser.role,
    });
    users.push(user);
  }

  await prisma.taskUserAssignment.deleteMany();
  await prisma.taskGroupAssignment.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.task.deleteMany();
  await prisma.group.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();

  // Create a workspace
  const workspace = await prisma.workspace.upsert({
    where: { id: 'workspace-uuid' },
    update: {},
    create: {
      id: 'workspace-uuid',
      tenantId: tenant.id,
      name: 'Default Workspace',
    },
  });

  // Create projects matching frontend mock data
  const projects: Project[] = [];
  const projectsData = [
    { id: 'project-1', name: 'SaaS Admin Portal', description: 'Frontend buildout for admin workflows', color: '#4f8eff', icon: '🧩' },
    { id: 'project-2', name: 'Task Service API', description: 'Core API and auth for task management', color: '#c8f060', icon: '⚙️' },
    { id: 'project-3', name: 'Mobile Client v1', description: 'React Native client for task execution', color: '#ffb84d', icon: '📱' },
    { id: 'project-4', name: 'Design System Refresh', description: 'Component library, tokens, and accessibility', color: '#ff5e7a', icon: '🎨' },
    { id: 'project-5', name: 'Data Platform', description: 'Event pipelines, warehouse, and reporting', color: '#3fddc7', icon: '📊' },
    { id: 'project-6', name: 'Release Engineering', description: 'CI/CD, environments, and automated releases', color: '#9b72ff', icon: '🚀' },
    { id: 'project-7', name: 'शंकर', description: 'Localized delivery track and stakeholder coordination', color: '#5dd3ff', icon: '🧭' }
  ];

  for (const projectData of projectsData) {
    const project = await prisma.project.upsert({
      where: { id: projectData.id },
      update: {},
      create: {
        id: projectData.id,
        workspaceId: workspace.id,
        name: projectData.name,
        description: projectData.description,
        color: projectData.color,
        icon: projectData.icon,
        ownerId: users[0].id,
      },
    });
    projects.push(project);
  }

  const ownerUser = users.find((user) => user.role === 'OWNER');
  const adminUsers = users.filter((user) => user.role === 'ADMIN');
  const memberUsers = users.filter((user) => user.role === 'MEMBER');
  const viewerUsers = users.filter((user) => user.role === 'VIEWER');

  if (ownerUser) {
    const membershipRows = projects.flatMap((project) => {
      const rows: Array<{ projectId: string; userId: string; role: 'OWNER' | 'EDITOR' | 'VIEWER' }> = [
        { projectId: project.id, userId: ownerUser.id, role: 'OWNER' },
      ];
      adminUsers.forEach((user) => rows.push({ projectId: project.id, userId: user.id, role: 'EDITOR' }));
      memberUsers.forEach((user) => rows.push({ projectId: project.id, userId: user.id, role: 'EDITOR' }));
      viewerUsers.forEach((user) => rows.push({ projectId: project.id, userId: user.id, role: 'VIEWER' }));
      return rows;
    });
    await prisma.projectMember.createMany({ data: membershipRows, skipDuplicates: true });
  }

  const groupsData = [
    { id: 'group-frontend', name: 'Frontend Guild', description: 'UI/UX and web experience builders', color: '#4f8eff' },
    { id: 'group-platform', name: 'Platform Ops', description: 'Infra, reliability, and data tooling', color: '#c8f060' },
    { id: 'group-qa', name: 'QA Squad', description: 'Testing, automation, and release readiness', color: '#ffb84d' }
  ];

  const groups: Group[] = [];
  for (const groupData of groupsData) {
    const group = await prisma.group.create({
      data: {
        id: groupData.id,
        tenantId: tenant.id,
        workspaceId: workspace.id,
        name: groupData.name,
        description: groupData.description,
        color: groupData.color,
        createdBy: users[0].id
      }
    });
    groups.push(group);
  }

  await prisma.groupMember.createMany({
    data: [
      { groupId: groups[0].id, userId: users[0].id, role: 'OWNER', addedBy: users[0].id },
      { groupId: groups[0].id, userId: users[1].id, role: 'MEMBER', addedBy: users[0].id },
      { groupId: groups[1].id, userId: users[1].id, role: 'OWNER', addedBy: users[0].id },
      { groupId: groups[1].id, userId: users[2].id, role: 'MEMBER', addedBy: users[0].id },
      { groupId: groups[2].id, userId: users[2].id, role: 'OWNER', addedBy: users[0].id }
    ]
  });

  const taskSeeds = [
    {
      projectId: projects[0].id,
      tasks: [
        { title: 'Finalize navigation and sidebar layout', status: 'IN_PROGRESS', priority: 'HIGH' },
        { title: 'Implement task list filters and search', status: 'TODO', priority: 'MEDIUM' },
        { title: 'Polish account settings and sessions UI', status: 'IN_REVIEW', priority: 'MEDIUM' },
        { title: 'Add empty states for project views', status: 'TODO', priority: 'LOW' },
        { title: 'Optimize dashboard widgets for mobile', status: 'TODO', priority: 'LOW' },
        { title: 'Introduce feature tour for new admins', status: 'TODO', priority: 'MEDIUM' }
      ]
    },
    {
      projectId: projects[1].id,
      tasks: [
        { title: 'Add assignment endpoints for users/groups', status: 'DONE', priority: 'HIGH' },
        { title: 'Harden auth refresh token rotation', status: 'IN_PROGRESS', priority: 'CRITICAL' },
        { title: 'Build audit logging for task updates', status: 'TODO', priority: 'MEDIUM' },
        { title: 'Create OpenAPI documentation', status: 'TODO', priority: 'LOW' },
        { title: 'Implement bulk task archive endpoint', status: 'TODO', priority: 'MEDIUM' },
        { title: 'Add rate limiting middleware', status: 'TODO', priority: 'HIGH' }
      ]
    },
    {
      projectId: projects[2].id,
      tasks: [
        { title: 'Implement task detail screen', status: 'IN_PROGRESS', priority: 'HIGH' },
        { title: 'Wire up API client auth', status: 'TODO', priority: 'MEDIUM' },
        { title: 'Offline cache for task lists', status: 'TODO', priority: 'LOW' },
        { title: 'Add push notification preferences', status: 'TODO', priority: 'LOW' }
      ]
    },
    {
      projectId: projects[3].id,
      tasks: [
        { title: 'Audit button styles and states', status: 'DONE', priority: 'MEDIUM' },
        { title: 'Refactor form inputs to new tokens', status: 'IN_PROGRESS', priority: 'HIGH' },
        { title: 'Add dark mode contrast checks', status: 'TODO', priority: 'HIGH' },
        { title: 'Ship typography scale updates', status: 'TODO', priority: 'MEDIUM' }
      ]
    },
    {
      projectId: projects[4].id,
      tasks: [
        { title: 'Define event taxonomy v2', status: 'IN_REVIEW', priority: 'HIGH' },
        { title: 'Backfill task events to warehouse', status: 'IN_PROGRESS', priority: 'CRITICAL' },
        { title: 'Build ops dashboard for pipelines', status: 'TODO', priority: 'MEDIUM' },
        { title: 'Create stakeholder KPI report', status: 'TODO', priority: 'LOW' }
      ]
    },
    {
      projectId: projects[5].id,
      tasks: [
        { title: 'Add canary deploy workflow', status: 'IN_PROGRESS', priority: 'HIGH' },
        { title: 'Automate staging refresh nightly', status: 'DONE', priority: 'MEDIUM' },
        { title: 'Document rollback playbooks', status: 'TODO', priority: 'MEDIUM' },
        { title: 'Upgrade CI agents to Node 22', status: 'TODO', priority: 'LOW' }
      ]
    },
    {
      projectId: projects[6].id,
      tasks: [
        { title: 'BEONJOB', status: 'TODO', priority: 'MEDIUM' },
        { title: 'Coordinate localized stakeholder review', status: 'IN_PROGRESS', priority: 'HIGH' }
      ]
    }
  ];

  const dueOffsetsDays = [-14, -7, -3, 2, 5, 8, 12, 15, 18, 22, 26, 30, 35, 40, 45, 55, 65, 75];
  const createdTasks: Task[] = [];
  let dueIndex = 0;
  for (const seed of taskSeeds) {
    for (const task of seed.tasks) {
      const dueOffset = dueOffsetsDays[dueIndex % dueOffsetsDays.length];
      dueIndex += 1;
      const startOffset = Math.min(dueOffset - 3, -1);
      const created = await prisma.task.create({
        data: {
          tenantId: tenant.id,
          projectId: seed.projectId,
          title: task.title,
          description: `${task.title}.`,
          status: task.status as any,
          priority: task.priority as any,
          createdBy: users[0].id,
          startDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * startOffset),
          dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * dueOffset)
        }
      });
      createdTasks.push(created);
    }
  }

  const assignableUserIds = users
    .filter((user) => user.role === 'OWNER' || user.role === 'ADMIN' || user.role === 'MEMBER')
    .map((user) => user.id);
  await assignUsersToTasks(createdTasks, assignableUserIds, ownerUser?.id || users[0].id);

  console.log('✅ Seed data created successfully');
  console.log('Tenant:', tenant.id);
  console.log('Users:', users.map(u => ({ id: u.id, email: u.email })));
  console.log('Workspace:', workspace.id);
  console.log('Projects:', projects.map(p => ({ id: p.id, name: p.name })));
  console.log('Groups:', groups.map(g => ({ id: g.id, name: g.name })));
  console.log('Tasks:', createdTasks.map(t => ({ id: t.id, title: t.title })));

  const seedTenant = async (input: {
    tenantId: string;
    tenantName: string;
    workspaceId: string;
    workspaceName: string;
    users: Array<{ id: string; email: string; displayName: string; role?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'GUEST' }>;
    projects: Array<{ id: string; name: string; description: string; color: string; icon: string; tasks: Array<{ title: string; status: string; priority: string }> }>;
  }) => {
    const tenantRecord = await prisma.tenant.upsert({
      where: { id: input.tenantId },
      update: { name: input.tenantName },
      create: { id: input.tenantId, name: input.tenantName }
    });
    await setTenantWebPortalUrl(tenantRecord.id, 'http://localhost:5175');
    await setTenantTimezone(tenantRecord.id, 'UTC');
    const existingWorkspaces = await prisma.workspace.findMany({
      where: { tenantId: tenantRecord.id },
      select: { id: true }
    });
    const workspaceIds = existingWorkspaces.map(workspace => workspace.id);

    await prisma.taskUserAssignment.deleteMany({
      where: { task: { tenantId: tenantRecord.id } }
    });
    await prisma.taskGroupAssignment.deleteMany({
      where: { task: { tenantId: tenantRecord.id } }
    });
    await prisma.task.deleteMany({ where: { tenantId: tenantRecord.id } });

    if (workspaceIds.length > 0) {
      await prisma.projectMember.deleteMany({
        where: { project: { workspaceId: { in: workspaceIds } } }
      });
      await prisma.project.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
      await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
    }

    const tenantUsers: User[] = [];
    for (const tenantUser of input.users) {
      const user = await upsertUser({
        id: tenantUser.id,
        tenantId: tenantRecord.id,
        email: tenantUser.email,
        displayName: tenantUser.displayName,
        role: tenantUser.role || 'MEMBER'
      });
      tenantUsers.push(user);
    }

    const workspaceRecord = await prisma.workspace.upsert({
      where: { id: input.workspaceId },
      update: { name: input.workspaceName, tenantId: tenantRecord.id },
      create: {
        id: input.workspaceId,
        tenantId: tenantRecord.id,
        name: input.workspaceName
      }
    });

    const projectRecords: Project[] = [];
    for (const project of input.projects) {
      const createdProject = await prisma.project.upsert({
        where: { id: project.id },
        update: {
          name: project.name,
          description: project.description,
          color: project.color,
          icon: project.icon,
          workspaceId: workspaceRecord.id,
          ownerId: tenantUsers[0].id
        },
        create: {
          id: project.id,
          workspaceId: workspaceRecord.id,
          name: project.name,
          description: project.description,
          color: project.color,
          icon: project.icon,
          ownerId: tenantUsers[0].id
        }
      });
      projectRecords.push(createdProject);
    }

    const tenantOwner = tenantUsers.find((user) => user.role === 'OWNER') || tenantUsers[0];
    const tenantAdmins = tenantUsers.filter((user) => user.role === 'ADMIN');
    const tenantMembers = tenantUsers.filter((user) => user.role === 'MEMBER');
    const tenantViewers = tenantUsers.filter((user) => user.role === 'VIEWER');

    const tenantMembershipRows = projectRecords.flatMap((project) => {
      const rows: Array<{ projectId: string; userId: string; role: 'OWNER' | 'EDITOR' | 'VIEWER' }> = [
        { projectId: project.id, userId: tenantOwner.id, role: 'OWNER' },
      ];
      tenantAdmins.forEach((user) => rows.push({ projectId: project.id, userId: user.id, role: 'EDITOR' }));
      tenantMembers.forEach((user) => rows.push({ projectId: project.id, userId: user.id, role: 'EDITOR' }));
      tenantViewers.forEach((user) => rows.push({ projectId: project.id, userId: user.id, role: 'VIEWER' }));
      return rows;
    });
    await prisma.projectMember.createMany({ data: tenantMembershipRows, skipDuplicates: true });

    const offsets = [-10, -4, 1, 4, 9, 14, 20, 28, 36, 50];
    let index = 0;
    for (const project of input.projects) {
      for (const task of project.tasks) {
        const dueOffset = offsets[index % offsets.length];
        const startOffset = Math.min(dueOffset - 2, -1);
        index += 1;
        await prisma.task.create({
          data: {
            tenantId: tenantRecord.id,
            projectId: project.id,
            title: task.title,
            description: `${task.title}.`,
            status: task.status as any,
            priority: task.priority as any,
            createdBy: tenantUsers[0].id,
            startDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * startOffset),
            dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * dueOffset)
          }
        });
      }
    }

    await assignUsersToTasks(
      await prisma.task.findMany({ where: { tenantId: tenantRecord.id } }),
      tenantUsers
        .filter((user) => user.role === 'OWNER' || user.role === 'ADMIN' || user.role === 'MEMBER')
        .map(user => user.id),
      tenantOwner.id
    );

    console.log(`✅ Seeded tenant ${tenantRecord.id} (${input.tenantName}) with ${projectRecords.length} projects`);
  };

  await seedTenant({
    tenantId: 'tenant-uuid',
    tenantName: 'Legacy Tenant',
    workspaceId: 'workspace-legacy',
    workspaceName: 'Legacy Workspace',
    users: [
      { id: 'user-legacy-owner', email: 'legacy.owner@example.com', displayName: 'Legacy Owner', role: 'OWNER' },
      { id: 'user-legacy-admin', email: 'legacy.admin@example.com', displayName: 'Legacy Admin', role: 'ADMIN' },
      { id: 'user-legacy-member', email: 'legacy.member@example.com', displayName: 'Legacy Member', role: 'MEMBER' },
      { id: 'user-legacy-viewer', email: 'legacy.viewer@example.com', displayName: 'Legacy Viewer', role: 'VIEWER' },
      { id: 'user-legacy-guest', email: 'legacy.guest@example.com', displayName: 'Legacy Guest', role: 'GUEST' }
    ],
    projects: [
      {
        id: 'legacy-project-1',
        name: 'SaaS Admin Portal',
        description: 'Frontend buildout for admin workflows',
        color: '#4f8eff',
        icon: '🧩',
        tasks: [
          { title: 'Finalize navigation and sidebar layout', status: 'IN_PROGRESS', priority: 'HIGH' },
          { title: 'Implement task list filters and search', status: 'TODO', priority: 'MEDIUM' },
          { title: 'Polish account settings and sessions UI', status: 'IN_REVIEW', priority: 'MEDIUM' },
          { title: 'Add empty states for project views', status: 'TODO', priority: 'LOW' },
          { title: 'Optimize dashboard widgets for mobile', status: 'TODO', priority: 'LOW' },
          { title: 'Introduce feature tour for new admins', status: 'TODO', priority: 'MEDIUM' }
        ]
      },
      {
        id: 'legacy-project-2',
        name: 'Task Service API',
        description: 'Core API and auth for task management',
        color: '#c8f060',
        icon: '⚙️',
        tasks: [
          { title: 'Add assignment endpoints for users/groups', status: 'DONE', priority: 'HIGH' },
          { title: 'Harden auth refresh token rotation', status: 'IN_PROGRESS', priority: 'CRITICAL' },
          { title: 'Build audit logging for task updates', status: 'TODO', priority: 'MEDIUM' },
          { title: 'Create OpenAPI documentation', status: 'TODO', priority: 'LOW' },
          { title: 'Implement bulk task archive endpoint', status: 'TODO', priority: 'MEDIUM' },
          { title: 'Add rate limiting middleware', status: 'TODO', priority: 'HIGH' }
        ]
      },
      {
        id: 'legacy-project-3',
        name: 'Mobile Client v1',
        description: 'React Native client for task execution',
        color: '#ffb84d',
        icon: '📱',
        tasks: [
          { title: 'Implement task detail screen', status: 'IN_PROGRESS', priority: 'HIGH' },
          { title: 'Wire up API client auth', status: 'TODO', priority: 'MEDIUM' },
          { title: 'Offline cache for task lists', status: 'TODO', priority: 'LOW' },
          { title: 'Add push notification preferences', status: 'TODO', priority: 'LOW' }
        ]
      },
      {
        id: 'legacy-project-4',
        name: 'Design System Refresh',
        description: 'Component library, tokens, and accessibility',
        color: '#ff5e7a',
        icon: '🎨',
        tasks: [
          { title: 'Audit button styles and states', status: 'DONE', priority: 'MEDIUM' },
          { title: 'Refactor form inputs to new tokens', status: 'IN_PROGRESS', priority: 'HIGH' },
          { title: 'Add dark mode contrast checks', status: 'TODO', priority: 'HIGH' },
          { title: 'Ship typography scale updates', status: 'TODO', priority: 'MEDIUM' }
        ]
      },
      {
        id: 'legacy-project-5',
        name: 'Data Platform',
        description: 'Event pipelines, warehouse, and reporting',
        color: '#3fddc7',
        icon: '📊',
        tasks: [
          { title: 'Define event taxonomy v2', status: 'IN_REVIEW', priority: 'HIGH' },
          { title: 'Backfill task events to warehouse', status: 'IN_PROGRESS', priority: 'CRITICAL' },
          { title: 'Build ops dashboard for pipelines', status: 'TODO', priority: 'MEDIUM' },
          { title: 'Create stakeholder KPI report', status: 'TODO', priority: 'LOW' }
        ]
      },
      {
        id: 'legacy-project-6',
        name: 'Release Engineering',
        description: 'CI/CD, environments, and automated releases',
        color: '#9b72ff',
        icon: '🚀',
        tasks: [
          { title: 'Add canary deploy workflow', status: 'IN_PROGRESS', priority: 'HIGH' },
          { title: 'Automate staging refresh nightly', status: 'DONE', priority: 'MEDIUM' },
          { title: 'Document rollback playbooks', status: 'TODO', priority: 'MEDIUM' },
          { title: 'Upgrade CI agents to Node 22', status: 'TODO', priority: 'LOW' }
        ]
      },
      {
        id: 'legacy-project-7',
        name: 'शंकर',
        description: 'Localized delivery track and stakeholder coordination',
        color: '#5dd3ff',
        icon: '🧭',
        tasks: [
          { title: 'BEONJOB', status: 'TODO', priority: 'MEDIUM' },
          { title: 'Prepare translation QA checklist', status: 'IN_PROGRESS', priority: 'HIGH' }
        ]
      }
    ]
  });

  await seedTenant({
    tenantId: 'tenant-photo',
    tenantName: 'Photo Studio',
    workspaceId: 'workspace-photo',
    workspaceName: 'Photography Workspace',
    users: [
      { id: 'user-photo-owner', email: 'photo.owner@example.com', displayName: 'Photo Owner', role: 'OWNER' },
      { id: 'user-photo-admin', email: 'photo.admin@example.com', displayName: 'Photo Admin', role: 'ADMIN' },
      { id: 'user-photo-member', email: 'photo.member@example.com', displayName: 'Photo Member', role: 'MEMBER' },
      { id: 'user-photo-viewer', email: 'photo.viewer@example.com', displayName: 'Photo Viewer', role: 'VIEWER' },
      { id: 'user-photo-guest', email: 'photo.guest@example.com', displayName: 'Photo Guest', role: 'GUEST' }
    ],
    projects: [
      {
        id: 'photo-project-1',
        name: 'Wedding Portfolio',
        description: 'Shot list, edits, and delivery pipeline.',
        color: '#ffb84d',
        icon: '📷',
        tasks: [
          { title: 'Finalize shot list with couple', status: 'IN_PROGRESS', priority: 'HIGH' },
          { title: 'Prep backup gear checklist', status: 'TODO', priority: 'MEDIUM' },
          { title: 'Color grade ceremony set', status: 'TODO', priority: 'HIGH' },
          { title: 'Deliver gallery to client', status: 'TODO', priority: 'MEDIUM' }
        ]
      },
      {
        id: 'photo-project-2',
        name: 'Brand Campaign',
        description: 'Studio product shoot for new launch.',
        color: '#4f8eff',
        icon: '💡',
        tasks: [
          { title: 'Scout studio lighting setups', status: 'DONE', priority: 'MEDIUM' },
          { title: 'Capture hero product shots', status: 'IN_PROGRESS', priority: 'HIGH' },
          { title: 'Retouch select images', status: 'TODO', priority: 'HIGH' },
          { title: 'Export web-ready assets', status: 'TODO', priority: 'LOW' }
        ]
      }
    ]
  });

  await seedTenant({
    tenantId: 'tenant-music',
    tenantName: 'Studio Sessions',
    workspaceId: 'workspace-music',
    workspaceName: 'Musician Workspace',
    users: [
      { id: 'user-music-owner', email: 'music.owner@example.com', displayName: 'Music Owner', role: 'OWNER' },
      { id: 'user-music-admin', email: 'music.admin@example.com', displayName: 'Music Admin', role: 'ADMIN' },
      { id: 'user-music-member', email: 'music.member@example.com', displayName: 'Music Member', role: 'MEMBER' },
      { id: 'user-music-viewer', email: 'music.viewer@example.com', displayName: 'Music Viewer', role: 'VIEWER' },
      { id: 'user-music-guest', email: 'music.guest@example.com', displayName: 'Music Guest', role: 'GUEST' }
    ],
    projects: [
      {
        id: 'music-project-1',
        name: 'EP Recording',
        description: 'Tracking, mixing, and mastering for new EP.',
        color: '#3fddc7',
        icon: '🎧',
        tasks: [
          { title: 'Finalize track list', status: 'DONE', priority: 'MEDIUM' },
          { title: 'Record rhythm section', status: 'IN_PROGRESS', priority: 'HIGH' },
          { title: 'Mix lead vocals', status: 'TODO', priority: 'HIGH' },
          { title: 'Master final mixes', status: 'TODO', priority: 'MEDIUM' }
        ]
      },
      {
        id: 'music-project-2',
        name: 'Tour Rehearsals',
        description: 'Prep setlist and cues for live shows.',
        color: '#9b72ff',
        icon: '🎤',
        tasks: [
          { title: 'Create rehearsal schedule', status: 'IN_PROGRESS', priority: 'MEDIUM' },
          { title: 'Lock backing tracks', status: 'TODO', priority: 'HIGH' },
          { title: 'Run full show rehearsal', status: 'TODO', priority: 'HIGH' },
          { title: 'Confirm stage plot', status: 'TODO', priority: 'LOW' }
        ]
      }
    ]
  });

  await seedTenant({
    tenantId: 'tenant-student',
    tenantName: 'Student Planner',
    workspaceId: 'workspace-student',
    workspaceName: 'Student Workspace',
    users: [
      { id: 'user-student-owner', email: 'student.owner@example.com', displayName: 'Student Owner', role: 'OWNER' },
      { id: 'user-student-admin', email: 'student.admin@example.com', displayName: 'Student Admin', role: 'ADMIN' },
      { id: 'user-student-member', email: 'student.member@example.com', displayName: 'Student Member', role: 'MEMBER' },
      { id: 'user-student-viewer', email: 'student.viewer@example.com', displayName: 'Student Viewer', role: 'VIEWER' },
      { id: 'user-student-guest', email: 'student.guest@example.com', displayName: 'Student Guest', role: 'GUEST' }
    ],
    projects: [
      {
        id: 'student-project-1',
        name: 'Semester Coursework',
        description: 'Assignments, labs, and exam prep.',
        color: '#c8f060',
        icon: '📚',
        tasks: [
          { title: 'Submit lab report 3', status: 'IN_PROGRESS', priority: 'HIGH' },
          { title: 'Prepare for midterm', status: 'TODO', priority: 'HIGH' },
          { title: 'Complete reading list', status: 'TODO', priority: 'MEDIUM' },
          { title: 'Group project checkpoint', status: 'TODO', priority: 'MEDIUM' }
        ]
      },
      {
        id: 'student-project-2',
        name: 'Capstone Project',
        description: 'Research, prototype, and presentation plan.',
        color: '#4f8eff',
        icon: '🧪',
        tasks: [
          { title: 'Draft project proposal', status: 'DONE', priority: 'MEDIUM' },
          { title: 'Build prototype MVP', status: 'IN_PROGRESS', priority: 'HIGH' },
          { title: 'Run user interviews', status: 'TODO', priority: 'MEDIUM' },
          { title: 'Create final slide deck', status: 'TODO', priority: 'LOW' }
        ]
      }
    ]
  });
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
