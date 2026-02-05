# Ansible Deployment Scripts

Clean, organized automation for deploying and managing your resume platform.

## 📋 Quick Reference

| Task | Command | Use When |
|------|---------|----------|
| **New Server Setup** | `ansible-playbook deploy-new-server.yml` | Fresh server, first deployment |
| **Update Code** | `ansible-playbook update-services.yml` | After git push, code changes |
| **Setup Database** | `ansible-playbook setup-database.yml` | New server, database setup |
| **Migrate Database** | `ansible-playbook migrate-database.yml` | Schema changes, migrations |

---

## 🚀 Usage Examples

### Deploy to New Server
```bash
ansible-playbook deploy-new-server.yml --ask-vault-pass --ask-become-pass --limit prod-server-1
```

### Update Code After Git Push
```bash
ansible-playbook update-services.yml --ask-vault-pass --ask-become-pass --limit prod-server-1
```

### Run Database Migrations
```bash
ansible-playbook migrate-database.yml --ask-vault-pass --ask-become-pass --limit prod-server-1
```

---

## 📁 File Structure

```
ansible/
├── deploy-new-server.yml      # 🆕 Complete server setup
├── update-services.yml         # 🔄 Update code
├── setup-database.yml          # 🗄️ Database installation
├── migrate-database.yml        # 🔄 Schema migrations
│
├── inventory-production.yml    # Server configuration
├── group_vars/all.yml          # Global variables
│
└── playbooks/                  # Modular sub-playbooks
    ├── 00-prerequisites.yml
    ├── 01-system-setup.yml
    ├── 02-database-setup.yml
    ├── 03-application-deploy.yml
    └── 04-nginx-setup.yml
```

---

## Configuration

Edit `inventory-production.yml` for your server details:

```yaml
all:
  hosts:
    prod-server-1:
      ansible_host: 172.16.23.127
      ansible_user: jose
```

Use ansible-vault for passwords in `group_vars/all.yml`.

---

For detailed documentation, see [DEPLOYMENT.md](DEPLOYMENT.md)
