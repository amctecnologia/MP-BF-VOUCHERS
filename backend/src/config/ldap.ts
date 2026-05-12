import ldap from 'ldapjs';

export interface LdapUser {
  dn: string;
  sAMAccountName: string;
  displayName: string;
  mail: string;
  memberOf: string[];
}

function escapeFilter(value: string): string {
  return value.replace(/[\\*()\x00]/g, (c) =>
    `\\${c.charCodeAt(0).toString(16).padStart(2, '0')}`
  );
}

function createClient(): ldap.Client {
  return ldap.createClient({
    url: process.env.LDAP_URL || 'ldap://localhost:389',
    timeout: 5000,
    connectTimeout: 5000,
  });
}

export async function authenticateUser(
  username: string,
  password: string
): Promise<LdapUser | null> {
  const searchBase = process.env.LDAP_SEARCH_BASE || '';
  const bindDn     = process.env.LDAP_BIND_DN      || '';
  const bindPass   = process.env.LDAP_BIND_PASSWORD || '';

  return new Promise((resolve) => {
    const client = createClient();
    client.on('error', () => resolve(null));

    client.bind(bindDn, bindPass, (bindErr) => {
      if (bindErr) { client.destroy(); return resolve(null); }

      client.search(searchBase, {
        filter: `(sAMAccountName=${escapeFilter(username)})`,
        scope: 'sub',
        attributes: ['dn', 'sAMAccountName', 'displayName', 'mail', 'memberOf'],
      }, (searchErr, res) => {
        if (searchErr) { client.destroy(); return resolve(null); }

        let userEntry: ldap.SearchEntry | null = null;
        res.on('searchEntry', (entry) => { userEntry = entry; });
        res.on('error', () => { client.destroy(); resolve(null); });
        res.on('end', () => {
          if (!userEntry) { client.destroy(); return resolve(null); }

          const dn  = userEntry.dn;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const obj = (userEntry as any).object as Record<string, string | string[]>;
          const get = (k: string): string[] => {
            const v = obj[k];
            if (!v) return [];
            return Array.isArray(v) ? v : [v];
          };

          const userClient = createClient();
          userClient.on('error', () => resolve(null));
          userClient.bind(dn, password, (authErr) => {
            userClient.destroy();
            client.destroy();
            if (authErr) return resolve(null);
            resolve({
              dn,
              sAMAccountName: get('sAMAccountName')[0] || username,
              displayName:    get('displayName')[0]    || username,
              mail:           get('mail')[0]           || '',
              memberOf:       get('memberOf'),
            });
          });
        });
      });
    });
  });
}

export function isInGroup(memberOf: string[], groupName: string): boolean {
  return memberOf.some((dn) =>
    dn.toLowerCase().includes(`cn=${groupName.toLowerCase()},`)
  );
}
