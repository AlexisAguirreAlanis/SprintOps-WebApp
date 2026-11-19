package com.pistache.sprintops_backend.service;

import tools.jackson.databind.JsonNode;
import com.pistache.sprintops_backend.model.AiConsumoCredito;
import com.pistache.sprintops_backend.model.AiCreditoAcceso;
import com.pistache.sprintops_backend.model.AiCreditoProyecto;
import com.pistache.sprintops_backend.model.AiCreditoUsuario;
import com.pistache.sprintops_backend.model.AiMovimientoCredito;
import com.pistache.sprintops_backend.model.AiPreferencia;
import com.pistache.sprintops_backend.model.AiTransaccion;
import com.pistache.sprintops_backend.model.Equipo;
import com.pistache.sprintops_backend.model.InfoUsuarioEquipo;
import com.pistache.sprintops_backend.model.Proyecto;
import com.pistache.sprintops_backend.model.Usuario;
import com.pistache.sprintops_backend.repository.AiConsumoCreditoRepository;
import com.pistache.sprintops_backend.repository.AiCreditoAccesoRepository;
import com.pistache.sprintops_backend.repository.AiCreditoProyectoRepository;
import com.pistache.sprintops_backend.repository.AiCreditoUsuarioRepository;
import com.pistache.sprintops_backend.repository.AiMovimientoCreditoRepository;
import com.pistache.sprintops_backend.repository.AiPreferenciaRepository;
import com.pistache.sprintops_backend.repository.AiTransaccionRepository;
import com.pistache.sprintops_backend.repository.InfoUsuarioEquipoRepository;
import com.pistache.sprintops_backend.repository.ProyectoRepository;
import com.pistache.sprintops_backend.service.chatbot.AiCreditTariff;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.UUID;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class AiCreditService {

    public static final int DEFAULT_LIMIT = 400;
    public static final int PERSONAL_LIMIT = 200;
    public static final String EXHAUSTED =
            "Te quedaste sin créditos de IA. Puedes esperar a tu próxima renovación o adquirir créditos adicionales para continuar.";

    @Autowired
    private AiCreditoProyectoRepository repository;
    @Autowired
    private AiCreditoAccesoRepository accesoRepository;
    @Autowired
    private AiCreditTariff tariff;
    @Autowired
    private ProyectoPermissionCheckService permissionCheckService;
    @Autowired
    private AiCreditoUsuarioRepository personalRepository;
    @Autowired
    private AiConsumoCreditoRepository consumoRepository;
    @Autowired
    private AiMovimientoCreditoRepository movimientoRepository;
    @Autowired
    private AiTransaccionRepository transaccionRepository;
    @Autowired
    private AiPreferenciaRepository preferenciaRepository;

    @Value("${sprintops.ai.payment-provider:}")
    private String paymentProvider;
    @Autowired
    private InfoUsuarioEquipoRepository membershipRepository;
    @Autowired
    private ProyectoRepository proyectoRepository;

    @Transactional
    public Map<String, Object> snapshot(Integer projectId) {
        return json(load(projectId));
    }

    /**
     * Gasta un crédito del proyecto. Lo usa el cupo compartido cuando el llamador
     * no indica usuario. Conserva el comportamiento anterior.
     */
    @Transactional
    public boolean tryConsume(Integer projectId) {
        AiCreditoProyecto row = load(projectId);
        if (row.getUsados() >= row.getLimiteMensual()) return false;
        row.setUsados(row.getUsados() + 1);
        repository.save(row);
        return true;
    }

    /** Gasta primero la bolsa elegida por el usuario y, si esa se agota, la otra. */
    @Transactional
    public boolean tryConsume(Integer projectId, Integer userId) {
        return consume(projectId, userId, 1, "simple", 0, 0) > 0;
    }

    @Transactional
    public int available(Integer projectId, Integer userId) {
        int total = personalRemaining(loadPersonal(userId));
        if (canSpendShared(userId, projectId)) total += sharedRemaining(load(projectId));
        return total;
    }

    @Transactional
    public Map<String, Object> balance(Integer projectId, Integer userId) {
        AiCreditoUsuario personal = loadPersonal(userId);
        boolean sharedOk = canSpendShared(userId, projectId);
        int personalLeft = personalRemaining(personal);
        int sharedLeft = sharedOk ? sharedRemaining(load(projectId)) : 0;
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("available", personalLeft + sharedLeft);
        body.put("personal", personalLeft);
        body.put("shared", sharedLeft);
        body.put("plan", tariff.planId(personal.getPlan()));
        body.put("planLabel", tariff.planLabel(personal.getPlan()));
        body.put("included", tariff.included(personal.getPlan()));
        body.put("extra", personal.getExtra());
        body.put("monthly", Math.max(0, tariff.included(personal.getPlan()) - personal.getUsados()));
        body.put("purchased", personal.getExtra());
        body.put("renewal", YearMonth.now().plusMonths(1).atDay(1).toString());
        body.put("packs", tariff.packs());
        body.put("canUseShared", sharedOk);
        body.put("owner", canManage(userId, projectId));
        return body;
    }

    @Transactional
    public Map<String, Object> notice(Integer userId) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("title", "Te quedaste sin créditos de IA");
        body.put("message", "Puedes esperar a tu próxima renovación o adquirir créditos adicionales para continuar.");
        body.put("renewal", YearMonth.now().plusMonths(1).atDay(1).toString());
        return body;
    }

    /** Cobra hasta `amount` créditos. No consulta datos del proyecto. */
    @Transactional
    public int consume(Integer projectId, Integer userId, int amount, String action, int promptTokens, int completionTokens) {
        return consume(projectId, userId, amount, action, promptTokens, completionTokens, null);
    }

    /**
     * La misma clave no descuenta dos veces. Un reintento de la solicitud
     * reutiliza el movimiento ya aplicado.
     */
    @Transactional
    public int consume(Integer projectId, Integer userId, int amount, String action, int promptTokens, int completionTokens, String clave) {
        if (amount <= 0 || userId == null) return 0;
        String key = chargeKey(clave);
        lockPersonal(userId);
        AiMovimientoCredito prior = movimientoRepository.findByClave(key).orElse(null);
        if (prior != null) return prior.getCreditos();
        int left = Math.min(amount, available(projectId, userId));
        if (left <= 0) return 0;
        boolean sharedFirst = canSpendShared(userId, projectId) && "shared".equals(pool(userId));
        int delPlan = 0;
        int comprados = 0;
        int compartidos = 0;
        boolean tokensStored = false;
        if (sharedFirst) {
            int[] took = takeShared(projectId, left);
            int sum = took[0] + took[1];
            if (sum > 0) {
                record(userId, projectId, "compartido", sum, action, promptTokens, completionTokens);
                tokensStored = true;
                compartidos += sum;
                left -= sum;
            }
        }
        if (left > 0) {
            int[] took = takePersonal(userId, left);
            int sum = took[0] + took[1];
            if (sum > 0) {
                record(userId, projectId, "personal", sum, action, tokensStored ? 0 : promptTokens, tokensStored ? 0 : completionTokens);
                tokensStored = true;
                delPlan += took[0];
                comprados += took[1];
                left -= sum;
            }
        }
        if (left > 0 && !sharedFirst && canSpendShared(userId, projectId)) {
            int[] took = takeShared(projectId, left);
            int sum = took[0] + took[1];
            if (sum > 0) {
                record(userId, projectId, "compartido", sum, action, tokensStored ? 0 : promptTokens, tokensStored ? 0 : completionTokens);
                compartidos += sum;
            }
        }
        int charged = delPlan + comprados + compartidos;
        if (charged <= 0) return 0;
        move(userId, projectId, key, "consumo", bag(delPlan, comprados, compartidos), charged, delPlan, comprados, compartidos, action);
        return charged;
    }

    /**
     * Registra la recarga y no toca el saldo. Acreditar créditos queda para cuando
     * exista un proveedor de pagos y las reglas comerciales.
     */
    @Transactional
    public Map<String, Object> preparePurchase(Integer userId, int credits, String requestId) {
        if (requestId == null || !requestId.matches("[A-Za-z0-9._:-]{8,80}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica la solicitud de recarga");
        }
        Integer price = tariff.packPrice(credits);
        if (price == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ese paquete no está disponible");
        }
        String key = "recarga:" + userId + ":" + requestId;
        AiTransaccion existing = transaccionRepository.findByClave(key).orElse(null);
        if (existing != null) return transactionJson(existing);
        AiTransaccion tx = new AiTransaccion();
        tx.setClave(key);
        tx.setUsuarioId(userId);
        tx.setCreditos(credits);
        tx.setPrecioMxn(price);
        tx.setMoneda("MXN");
        tx.setEstado("preparada");
        tx.setProveedor("");
        tx.setCreadoEn(Instant.now());
        transaccionRepository.save(tx);
        return transactionJson(tx);
    }

    /**
     * Punto de extensión para un cobro ya confirmado por el proveedor.
     * No lo llama ningún endpoint: sin proveedor configurado se niega.
     */
    @Transactional
    public Map<String, Object> acreditar(String clave) {
        if (paymentProvider == null || paymentProvider.isBlank()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "No hay proveedor de pagos configurado");
        }
        AiTransaccion tx = transaccionRepository.findByClave(clave)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recarga no encontrada"));
        if ("acreditada".equals(tx.getEstado())) return transactionJson(tx);
        if (!"preparada".equals(tx.getEstado())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La recarga no se puede acreditar");
        }
        String movementKey = chargeKey("acreditada:" + tx.getIdTransaccion());
        if (movimientoRepository.findByClave(movementKey).isEmpty()) {
            AiCreditoUsuario row = loadPersonal(tx.getUsuarioId());
            row.setExtra(Math.min(100_000, row.getExtra() + tx.getCreditos()));
            personalRepository.save(row);
            move(tx.getUsuarioId(), null, movementKey, "recarga", "comprado", tx.getCreditos(), 0, tx.getCreditos(), 0, "recarga");
        }
        tx.setEstado("acreditada");
        tx.setProveedor(paymentProvider.trim());
        transaccionRepository.save(tx);
        return transactionJson(tx);
    }

    @Transactional
    public boolean canManage(Integer userId, Integer projectId) {
        if (userId == null || projectId == null) return false;
        Proyecto project = proyectoRepository.findById(projectId).orElse(null);
        if (project != null && project.getCreador() != null && userId.equals(project.getCreador().getIdUsuario())) return true;
        return permissionCheckService.memberHasPermission(userId, projectId, "canManageMembers");
    }

    @Transactional
    public Map<String, Object> updateShared(Integer projectId, Integer userId, JsonNode body) {
        if (!canManage(userId, projectId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No puedes cambiar los créditos de este proyecto");
        }
        AiCreditoProyecto row = load(projectId);
        if (body.has("enabled")) row.setCompartido(body.get("enabled").asBoolean());
        if (body.has("limit") && body.get("limit").isNumber()) {
            int limit = body.get("limit").asInt();
            if (limit < 0 || limit > 100_000) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El límite mensual debe estar entre 0 y 100000");
            }
            row.setLimiteMensual(limit);
        }
        if (body.has("add") && body.get("add").isNumber()) {
            int add = body.get("add").asInt();
            if (add < 0 || add > 100_000) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica cuántos créditos agregar");
            }
            if (add > 0) {
                String requestId = body.path("requestId").asText("").trim();
                String assignmentKey = requestId.isEmpty()
                        ? "asignacion:" + projectId + ":" + UUID.randomUUID()
                        : chargeKey("asignacion:" + userId + ":" + projectId + ":" + requestId);
                if (movimientoRepository.findByClave(assignmentKey).isEmpty()) {
                    row.setExtra(Math.min(100_000, row.getExtra() + add));
                    move(userId, projectId, assignmentKey, "asignacion", "compartido", add, 0, 0, add, "asignacion");
                }
            }
        }
        if (body.has("collaborators") && body.get("collaborators").isArray()) {
            row.setAccesoExplicito(true);
            accesoRepository.deleteByProyectoId(projectId);
            Set<Integer> members = memberIds(projectId);
            for (JsonNode item : body.get("collaborators")) {
                if (!item.isNumber()) continue;
                int collaborator = item.asInt();
                if (!members.contains(collaborator)) continue;
                AiCreditoAcceso access = new AiCreditoAcceso();
                access.setProyectoId(projectId);
                access.setUsuarioId(collaborator);
                accesoRepository.save(access);
            }
        }
        repository.save(row);
        return json(row);
    }

    @Transactional
    public Map<String, Object> account(Integer userId) {
        String period = YearMonth.now().toString();
        AiCreditoUsuario personal = loadPersonal(userId);
        List<Map<String, Object>> projects = new ArrayList<>();
        Map<Integer, String> names = new LinkedHashMap<>();
        int sharedLimit = 0;
        int sharedUsed = 0;
        int sharedRemaining = 0;
        Set<Integer> seen = new LinkedHashSet<>();
        for (Proyecto project : memberProjects(userId)) {
            if (!seen.add(project.getIdProyecto())) continue;
            boolean spendable = canSpendShared(userId, project.getIdProyecto());
            Map<String, Object> snap = snapshot(project.getIdProyecto());
            int limit = number(snap.get("limit"));
            int used = number(snap.get("used"));
            int remaining = spendable ? number(snap.get("remaining")) : 0;
            if (spendable) {
                sharedLimit += limit;
                sharedUsed += used;
                sharedRemaining += remaining;
            }
            String name = project.getNombreProyecto() != null ? project.getNombreProyecto() : "Proyecto";
            names.put(project.getIdProyecto(), name);
            if (!spendable) continue;
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("projectId", project.getIdProyecto());
            item.put("name", name);
            item.put("limit", limit);
            item.put("used", used);
            item.put("remaining", remaining);
            projects.add(item);
        }
        List<Map<String, Object>> history = new ArrayList<>();
        for (AiConsumoCredito item : consumoRepository.findTop20ByUsuarioIdAndPeriodoOrderByIdConsumoDesc(userId, period)) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", item.getIdConsumo());
            row.put("pool", "compartido".equals(item.getBolsa()) ? "shared" : "personal");
            row.put("projectId", item.getProyectoId());
            row.put("projectName", names.getOrDefault(item.getProyectoId(), "Proyecto"));
            row.put("action", tariff.label(item.getAccion()));
            row.put("credits", Math.max(1, item.getCreditos()));
            row.put("at", item.getCreadoEn() != null ? item.getCreadoEn().toString() : "");
            history.add(row);
        }
        Map<String, Object> shared = new LinkedHashMap<>();
        shared.put("limit", sharedLimit);
        shared.put("used", sharedUsed);
        shared.put("remaining", sharedRemaining);
        shared.put("projects", projects);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("personal", jsonPersonal(personal));
        body.put("shared", shared);
        body.put("monthUsed", consumoRepository.sumByUsuarioIdAndPeriodo(userId, period));
        body.put("renewal", YearMonth.now().plusMonths(1).atDay(1).toString());
        body.put("period", period);
        body.put("history", history);
        body.put("transactions", transactions(userId));
        body.put("movements", movements(userId));
        body.put("plans", tariff.plans());
        body.put("packs", tariff.packs());
        body.put("managed", managed(userId));
        body.put("canUseShared", !projects.isEmpty());
        return body;
    }

    @Transactional
    public Map<String, Object> updateLimit(Integer projectId, int limit) {
        if (limit < 0 || limit > 100_000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El límite mensual debe estar entre 0 y 100000");
        }
        AiCreditoProyecto row = load(projectId);
        row.setLimiteMensual(limit);
        row.setCompartido(true);
        repository.save(row);
        return json(row);
    }

    private int[] takeShared(Integer projectId, int amount) {
        lockProject(projectId);
        AiCreditoProyecto row = load(projectId);
        int monthly = Math.max(0, row.getLimiteMensual() - row.getUsados());
        int fromMonthly = Math.min(amount, monthly);
        int fromExtra = Math.min(amount - fromMonthly, row.getExtra());
        if (fromMonthly == 0 && fromExtra == 0) return new int[] {0, 0};
        row.setUsados(row.getUsados() + fromMonthly);
        row.setExtra(row.getExtra() - fromExtra);
        repository.save(row);
        return new int[] {fromMonthly, fromExtra};
    }

    private int[] takePersonal(Integer userId, int amount) {
        AiCreditoUsuario row = loadPersonal(userId);
        int monthly = Math.max(0, tariff.included(row.getPlan()) - row.getUsados());
        int fromMonthly = Math.min(amount, monthly);
        int fromExtra = Math.min(amount - fromMonthly, row.getExtra());
        if (fromMonthly == 0 && fromExtra == 0) return new int[] {0, 0};
        row.setUsados(row.getUsados() + fromMonthly);
        row.setExtra(row.getExtra() - fromExtra);
        personalRepository.save(row);
        return new int[] {fromMonthly, fromExtra};
    }

    private void record(Integer userId, Integer projectId, String pool, int credits, String action, int promptTokens, int completionTokens) {
        AiConsumoCredito row = new AiConsumoCredito();
        row.setUsuarioId(userId);
        row.setProyectoId(projectId);
        row.setBolsa(pool);
        row.setCreditos(Math.max(1, credits));
        row.setAccion(action == null ? "simple" : action);
        row.setTokensEntrada(Math.max(0, promptTokens));
        row.setTokensSalida(Math.max(0, completionTokens));
        row.setPeriodo(YearMonth.now().toString());
        row.setCreadoEn(Instant.now());
        consumoRepository.save(row);
    }

    private boolean canSpendShared(Integer userId, Integer projectId) {
        if (!member(userId, projectId)) return false;
        AiCreditoProyecto row = load(projectId);
        if (!row.isCompartido()) return false;
        if (!row.isAccesoExplicito()) return true;
        return accesoRepository.existsByProyectoIdAndUsuarioId(projectId, userId);
    }

    private int personalRemaining(AiCreditoUsuario row) {
        return Math.max(0, tariff.included(row.getPlan()) - row.getUsados()) + Math.max(0, row.getExtra());
    }

    private int poolBalance(AiCreditoProyecto row) {
        return Math.max(0, row.getLimiteMensual() - row.getUsados()) + Math.max(0, row.getExtra());
    }

    private int sharedRemaining(AiCreditoProyecto row) {
        if (!row.isCompartido()) return 0;
        return poolBalance(row);
    }

    private List<Map<String, Object>> managed(Integer userId) {
        List<Map<String, Object>> rows = new ArrayList<>();
        Set<Integer> seen = new HashSet<>();
        for (Proyecto project : memberProjects(userId)) {
            if (!seen.add(project.getIdProyecto()) || !canManage(userId, project.getIdProyecto())) continue;
            AiCreditoProyecto pool = load(project.getIdProyecto());
            Map<Integer, String> names = new LinkedHashMap<>();
            List<Map<String, Object>> members = new ArrayList<>();
            Set<Integer> allowed = new HashSet<>();
            for (AiCreditoAcceso access : accesoRepository.findByProyectoId(project.getIdProyecto())) {
                allowed.add(access.getUsuarioId());
            }
            if (project.getEquipo() != null) {
                for (InfoUsuarioEquipo membership : membershipRepository.findByEquipoIdEquipo(project.getEquipo().getIdEquipo())) {
                    Usuario person = membership.getUsuario();
                    if (person == null || person.getIdUsuario() == null) continue;
                    names.put(person.getIdUsuario(), person.getNombreUsuario() != null ? person.getNombreUsuario() : "Usuario");
                    Map<String, Object> member = new LinkedHashMap<>();
                    member.put("id", person.getIdUsuario());
                    member.put("name", names.get(person.getIdUsuario()));
                    member.put("authorized", !pool.isAccesoExplicito() || allowed.contains(person.getIdUsuario()));
                    members.add(member);
                }
            }
            List<Map<String, Object>> consumption = new ArrayList<>();
            for (AiConsumoCredito item : consumoRepository.findTop12ByProyectoIdAndBolsaAndPeriodoOrderByIdConsumoDesc(
                    project.getIdProyecto(), "compartido", YearMonth.now().toString())) {
                Map<String, Object> line = new LinkedHashMap<>();
                line.put("id", item.getIdConsumo());
                line.put("name", names.getOrDefault(item.getUsuarioId(), "Usuario"));
                line.put("action", tariff.label(item.getAccion()));
                line.put("credits", Math.max(1, item.getCreditos()));
                line.put("at", item.getCreadoEn() != null ? item.getCreadoEn().toString() : "");
                consumption.add(line);
            }
            Map<String, Object> row = json(pool);
            row.put("name", project.getNombreProyecto() != null ? project.getNombreProyecto() : "Proyecto");
            row.put("enabled", pool.isCompartido());
            row.put("explicit", pool.isAccesoExplicito());
            row.put("members", members);
            row.put("consumption", consumption);
            rows.add(row);
        }
        return rows;
    }

    private Set<Integer> memberIds(Integer projectId) {
        Set<Integer> ids = new HashSet<>();
        Proyecto project = proyectoRepository.findById(projectId).orElse(null);
        if (project == null || project.getEquipo() == null) return ids;
        for (InfoUsuarioEquipo membership : membershipRepository.findByEquipoIdEquipo(project.getEquipo().getIdEquipo())) {
            if (membership.getUsuario() != null && membership.getUsuario().getIdUsuario() != null) {
                ids.add(membership.getUsuario().getIdUsuario());
            }
        }
        return ids;
    }

    private String pool(Integer userId) {
        return preferenciaRepository.findByUsuarioId(userId)
                .map(AiPreferencia::getCreditosPrimero)
                .filter("shared"::equals)
                .orElse("personal");
    }

    private boolean member(Integer userId, Integer projectId) {
        if (userId == null || projectId == null) return false;
        return proyectoRepository.findById(projectId)
                .filter(project -> project.getEquipo() != null)
                .map(project -> membershipRepository.findById(
                        new InfoUsuarioEquipo.InfoUsuarioEquipoId(project.getEquipo().getIdEquipo(), userId)).isPresent())
                .orElse(false);
    }

    private List<Proyecto> memberProjects(Integer userId) {
        List<Proyecto> projects = new ArrayList<>();
        for (InfoUsuarioEquipo membership : membershipRepository.findByUsuarioIdUsuario(userId)) {
            Equipo team = membership.getEquipo();
            if (team == null) continue;
            projects.addAll(proyectoRepository.findByEquipo(team));
        }
        return projects;
    }

    private AiCreditoProyecto load(Integer projectId) {
        AiCreditoProyecto row = repository.findByProyectoId(projectId).orElseGet(() -> {
            AiCreditoProyecto created = new AiCreditoProyecto();
            created.setProyectoId(projectId);
            created.setCompartido(false);
            created.setLimiteMensual(0);
            created.setExtra(0);
            created.setAccesoExplicito(false);
            created.setUsados(0);
            created.setPeriodo(YearMonth.now().toString());
            return repository.save(created);
        });
        String period = YearMonth.now().toString();
        if (!period.equals(row.getPeriodo())) {
            row.setPeriodo(period);
            row.setUsados(0);
            repository.save(row);
        }
        return row;
    }

    private AiCreditoUsuario loadPersonal(Integer userId) {
        AiCreditoUsuario row = personalRepository.findByUsuarioId(userId).orElseGet(() -> {
            AiCreditoUsuario created = new AiCreditoUsuario();
            created.setUsuarioId(userId);
            created.setLimiteMensual(tariff.included("free"));
            created.setPlan("free");
            created.setExtra(0);
            created.setUsados(0);
            created.setPeriodo(YearMonth.now().toString());
            return personalRepository.save(created);
        });
        String period = YearMonth.now().toString();
        if (row.getPlan() == null || row.getPlan().isBlank()) {
            row.setPlan("free");
            personalRepository.save(row);
        }
        if (!period.equals(row.getPeriodo())) {
            personalRepository.lockByUsuarioId(userId);
            AiCreditoUsuario current = personalRepository.findByUsuarioId(userId).orElse(row);
            if (period.equals(current.getPeriodo())) return current;
            current.setPeriodo(period);
            current.setUsados(0);
            personalRepository.save(current);
            String renewalKey = "renovacion:" + userId + ":" + period;
            if (movimientoRepository.findByClave(renewalKey).isEmpty()) {
                int included = tariff.included(current.getPlan());
                move(userId, null, renewalKey, "renovacion", "mensual", included, included, 0, 0, "renovacion");
            }
            return current;
        }
        return row;
    }

    private Map<String, Object> json(AiCreditoProyecto row) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("projectId", row.getProyectoId());
        body.put("shared", row.isCompartido());
        body.put("enabled", row.isCompartido());
        body.put("limit", row.getLimiteMensual());
        body.put("extra", row.getExtra());
        body.put("used", row.getUsados());
        body.put("balance", poolBalance(row));
        body.put("remaining", sharedRemaining(row));
        body.put("period", row.getPeriodo());
        return body;
    }

    private Map<String, Object> jsonPersonal(AiCreditoUsuario row) {
        int included = tariff.included(row.getPlan());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("plan", tariff.planId(row.getPlan()));
        body.put("planLabel", tariff.planLabel(row.getPlan()));
        int monthlyLeft = Math.max(0, included - row.getUsados());
        body.put("included", included);
        body.put("extra", row.getExtra());
        body.put("monthly", monthlyLeft);
        body.put("purchased", row.getExtra());
        body.put("limit", included);
        body.put("used", row.getUsados());
        body.put("remaining", personalRemaining(row));
        body.put("period", row.getPeriodo());
        return body;
    }

    private void lockPersonal(Integer userId) {
        loadPersonal(userId);
        personalRepository.lockByUsuarioId(userId);
    }

    private void lockProject(Integer projectId) {
        if (projectId == null) return;
        load(projectId);
        repository.lockByProyectoId(projectId);
    }

    private static String chargeKey(String clave) {
        if (clave == null || clave.isBlank()) return "unico:" + UUID.randomUUID();
        String clean = clave.trim();
        return clean.length() > 120 ? clean.substring(0, 120) : clean;
    }

    private static String bag(int delPlan, int comprados, int compartidos) {
        int kinds = (delPlan > 0 ? 1 : 0) + (comprados > 0 ? 1 : 0) + (compartidos > 0 ? 1 : 0);
        if (kinds > 1) return "mixto";
        if (comprados > 0) return "comprado";
        if (compartidos > 0) return "compartido";
        return "mensual";
    }

    private void move(Integer userId, Integer projectId, String clave, String tipo, String bolsa, int creditos,
                      int delPlan, int comprados, int compartidos, String accion) {
        AiMovimientoCredito row = new AiMovimientoCredito();
        row.setClave(chargeKey(clave));
        row.setUsuarioId(userId);
        row.setProyectoId(projectId);
        row.setTipo(tipo);
        row.setBolsa(bolsa);
        row.setCreditos(Math.max(0, creditos));
        row.setDelPlan(Math.max(0, delPlan));
        row.setComprados(Math.max(0, comprados));
        row.setCompartidos(Math.max(0, compartidos));
        row.setAccion(accion == null ? "" : accion);
        row.setCreadoEn(Instant.now());
        movimientoRepository.save(row);
    }

    private List<Map<String, Object>> transactions(Integer userId) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (AiTransaccion item : transaccionRepository.findTop20ByUsuarioIdOrderByIdTransaccionDesc(userId)) {
            rows.add(transactionJson(item));
        }
        return rows;
    }

    private List<Map<String, Object>> movements(Integer userId) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (AiMovimientoCredito item : movimientoRepository.findTop20ByUsuarioIdOrderByIdMovimientoDesc(userId)) {
            rows.add(movementJson(item));
        }
        return rows;
    }

    private Map<String, Object> transactionJson(AiTransaccion tx) {
        boolean credited = "acreditada".equals(tx.getEstado());
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", tx.getIdTransaccion());
        row.put("credits", tx.getCreditos());
        row.put("price", tx.getPrecioMxn());
        row.put("currency", tx.getMoneda() == null || tx.getMoneda().isBlank() ? "MXN" : tx.getMoneda());
        row.put("status", tx.getEstado());
        row.put("statusLabel", credited ? "Acreditada" : "Preparada");
        row.put("at", tx.getCreadoEn() != null ? tx.getCreadoEn().toString() : "");
        row.put("message", credited
                ? "Los créditos comprados ya están en tu saldo y no se reinician con el plan."
                : "Recarga preparada. No se realizó ningún cargo y los créditos no se sumaron: falta definir el proveedor de pagos.");
        return row;
    }

    private Map<String, Object> movementJson(AiMovimientoCredito item) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", item.getIdMovimiento());
        row.put("type", item.getTipo());
        row.put("pool", item.getBolsa());
        row.put("credits", item.getCreditos());
        row.put("monthly", item.getDelPlan());
        row.put("purchased", item.getComprados());
        row.put("shared", item.getCompartidos());
        row.put("projectId", item.getProyectoId());
        row.put("label", movementLabel(item));
        row.put("detail", movementDetail(item));
        row.put("at", item.getCreadoEn() != null ? item.getCreadoEn().toString() : "");
        return row;
    }

    private String movementLabel(AiMovimientoCredito item) {
        return switch (item.getTipo() == null ? "" : item.getTipo()) {
            case "renovacion" -> "Renovación del plan";
            case "asignacion" -> "Asignación al proyecto";
            case "recarga" -> "Recarga acreditada";
            default -> tariff.label(item.getAccion());
        };
    }

    private static String movementDetail(AiMovimientoCredito item) {
        List<String> parts = new ArrayList<>();
        if (item.getDelPlan() > 0) parts.add(item.getDelPlan() + " del plan");
        if (item.getComprados() > 0) parts.add(item.getComprados() + " comprados");
        if (item.getCompartidos() > 0) parts.add(item.getCompartidos() + " compartidos");
        if (parts.size() < 2) return "";
        return String.join(", ", parts);
    }

    private static int number(Object value) {
        return value instanceof Number number ? number.intValue() : 0;
    }
}
