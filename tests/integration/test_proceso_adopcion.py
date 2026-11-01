"""Evidencia de integración entre la API de Adopciones y la API de Mascotas."""
import uuid
from concurrent.futures import ThreadPoolExecutor

import httpx
import psycopg
import pytest

from conftest import HEADERS_ADMIN, INTERNA, URL_ADOPCIONES, iniciar_mascotas


def _estado_mascota(api_mascotas: httpx.Client, mascota_id: str) -> str:
    return api_mascotas.get(f"/mascotas/{mascota_id}").json()["estado"]


def test_proceso_completo_de_adopcion(api_mascotas, api_adopciones, mascota, nueva_solicitud):
    """Consultar, verificar disponibilidad, solicitar, aprobar y actualizar en ambos servicios."""
    assert api_mascotas.get(f"/mascotas/{mascota['id']}").status_code == 200
    assert api_mascotas.get(f"/mascotas/{mascota['id']}/disponibilidad").json()["disponible"] is True

    solicitud = nueva_solicitud(mascota["id"])
    assert solicitud.status_code == 201, solicitud.text
    solicitud = solicitud.json()
    assert solicitud["estado"] == "pendiente"
    assert solicitud["mascota_nombre"] == "Guayaba"

    aprobada = api_adopciones.post(f"/solicitudes/{solicitud['id']}/aprobar", headers=HEADERS_ADMIN)
    assert aprobada.status_code == 200, aprobada.text
    assert aprobada.json()["estado"] == "aprobada"
    assert aprobada.json()["decidido_en"] is not None

    assert _estado_mascota(api_mascotas, mascota["id"]) == "adoptada"
    assert api_mascotas.get(f"/mascotas/{mascota['id']}/disponibilidad").json()["disponible"] is False
    assert api_adopciones.get(f"/solicitudes/{solicitud['id']}").json()["estado"] == "aprobada"


def test_rechazar_deja_la_mascota_disponible(api_mascotas, api_adopciones, mascota, nueva_solicitud):
    solicitud = nueva_solicitud(mascota["id"]).json()
    rechazada = api_adopciones.post(
        f"/solicitudes/{solicitud['id']}/rechazar",
        headers=HEADERS_ADMIN,
        json={"motivo": "La vivienda no tiene espacio suficiente."},
    )
    assert rechazada.status_code == 200, rechazada.text
    assert rechazada.json()["estado"] == "rechazada"
    assert rechazada.json()["motivo_rechazo"] == "La vivienda no tiene espacio suficiente."
    assert _estado_mascota(api_mascotas, mascota["id"]) == "disponible"


def test_aprobar_rechaza_las_demas_pendientes(api_adopciones, mascota, nueva_solicitud):
    primera = nueva_solicitud(mascota["id"]).json()
    segunda = nueva_solicitud(mascota["id"]).json()
    api_adopciones.post(f"/solicitudes/{primera['id']}/aprobar", headers=HEADERS_ADMIN).raise_for_status()

    cerrada = api_adopciones.get(f"/solicitudes/{segunda['id']}").json()
    assert cerrada["estado"] == "rechazada"
    assert "otra solicitud" in cerrada["motivo_rechazo"]


def test_aprobaciones_simultaneas_solo_una_gana(api_mascotas, api_adopciones, mascota, nueva_solicitud):
    """Ocho aprobaciones en paralelo sobre la misma mascota: una sola adopción aprobada."""
    solicitudes = [nueva_solicitud(mascota["id"]).json()["id"] for _ in range(8)]

    def aprobar(solicitud_id: str) -> int:
        with httpx.Client(base_url=URL_ADOPCIONES, timeout=30) as cliente:
            return cliente.post(f"/solicitudes/{solicitud_id}/aprobar", headers=HEADERS_ADMIN).status_code

    with ThreadPoolExecutor(max_workers=8) as hilos:
        codigos = list(hilos.map(aprobar, solicitudes))

    assert codigos.count(200) == 1, codigos
    assert codigos.count(409) == 7, codigos

    listado = api_adopciones.get(
        "/solicitudes", params={"mascota_id": mascota["id"], "estado": "aprobada"}, headers=HEADERS_ADMIN
    ).json()
    assert listado["total"] == 1
    assert _estado_mascota(api_mascotas, mascota["id"]) == "adoptada"


def test_no_se_puede_solicitar_una_mascota_adoptada(api_adopciones, mascota, nueva_solicitud):
    primera = nueva_solicitud(mascota["id"]).json()
    api_adopciones.post(f"/solicitudes/{primera['id']}/aprobar", headers=HEADERS_ADMIN).raise_for_status()
    respuesta = nueva_solicitud(mascota["id"])
    assert respuesta.status_code == 409
    assert "no está disponible" in respuesta.json()["detail"]


def test_no_se_puede_solicitar_una_mascota_en_tratamiento(api_mascotas, mascota, nueva_solicitud):
    api_mascotas.patch(
        f"/mascotas/{mascota['id']}", headers=HEADERS_ADMIN, json={"estado": "en_tratamiento"}
    ).raise_for_status()
    assert nueva_solicitud(mascota["id"]).status_code == 409


def test_aprobar_falla_si_la_mascota_dejo_de_estar_disponible(api_mascotas, api_adopciones, mascota, nueva_solicitud):
    solicitud = nueva_solicitud(mascota["id"]).json()
    api_mascotas.patch(
        f"/mascotas/{mascota['id']}", headers=HEADERS_ADMIN, json={"estado": "en_tratamiento"}
    ).raise_for_status()
    respuesta = api_adopciones.post(f"/solicitudes/{solicitud['id']}/aprobar", headers=HEADERS_ADMIN)
    assert respuesta.status_code == 409
    assert api_adopciones.get(f"/solicitudes/{solicitud['id']}").json()["estado"] == "pendiente"


def test_solicitud_de_mascota_inexistente(nueva_solicitud):
    assert nueva_solicitud(str(uuid.uuid4())).status_code == 404


def test_solicitud_duplicada_de_la_misma_persona(mascota, nueva_solicitud):
    assert nueva_solicitud(mascota["id"], solicitante_email="laura@correo.co").status_code == 201
    repetida = nueva_solicitud(mascota["id"], solicitante_email="LAURA@correo.co")
    assert repetida.status_code == 409
    assert "pendiente" in repetida.json()["detail"]


def test_una_solicitud_decidida_no_se_vuelve_a_decidir(api_adopciones, mascota, nueva_solicitud):
    solicitud = nueva_solicitud(mascota["id"]).json()
    api_adopciones.post(f"/solicitudes/{solicitud['id']}/aprobar", headers=HEADERS_ADMIN).raise_for_status()
    assert api_adopciones.post(f"/solicitudes/{solicitud['id']}/aprobar", headers=HEADERS_ADMIN).status_code == 409
    respuesta = api_adopciones.post(
        f"/solicitudes/{solicitud['id']}/rechazar", headers=HEADERS_ADMIN, json={"motivo": "Cambio de decisión"}
    )
    assert respuesta.status_code == 409


def test_el_registro_de_adopcion_es_idempotente(api_mascotas, mascota):
    headers = {"X-Service-Key": INTERNA}
    solicitud_id = str(uuid.uuid4())
    ruta = f"/mascotas/{mascota['id']}/adopcion"
    assert api_mascotas.put(ruta, headers=headers, json={"solicitud_id": solicitud_id}).status_code == 200
    assert api_mascotas.put(ruta, headers=headers, json={"solicitud_id": solicitud_id}).status_code == 200
    assert api_mascotas.put(ruta, headers=headers, json={"solicitud_id": str(uuid.uuid4())}).status_code == 409


def test_la_compensacion_libera_solo_su_propia_adopcion(api_mascotas, mascota):
    headers = {"X-Service-Key": INTERNA}
    solicitud_id = str(uuid.uuid4())
    ruta = f"/mascotas/{mascota['id']}/adopcion"
    api_mascotas.put(ruta, headers=headers, json={"solicitud_id": solicitud_id}).raise_for_status()

    api_mascotas.delete(ruta, headers=headers, params={"solicitud_id": str(uuid.uuid4())}).raise_for_status()
    assert _estado_mascota(api_mascotas, mascota["id"]) == "adoptada"

    api_mascotas.delete(ruta, headers=headers, params={"solicitud_id": solicitud_id}).raise_for_status()
    assert _estado_mascota(api_mascotas, mascota["id"]) == "disponible"


@pytest.mark.parametrize(
    ("metodo", "ruta"),
    [("GET", "/solicitudes"), ("POST", f"/solicitudes/{uuid.uuid4()}/aprobar")],
)
def test_gestion_de_solicitudes_exige_clave(api_adopciones, metodo, ruta):
    assert api_adopciones.request(metodo, ruta).status_code == 401
    assert api_adopciones.request(metodo, ruta, headers={"X-Admin-Key": "clave-incorrecta"}).status_code == 401


def test_administrar_mascotas_exige_clave(api_mascotas, mascota):
    assert api_mascotas.post("/mascotas", json={}).status_code == 401
    assert api_mascotas.patch(f"/mascotas/{mascota['id']}", json={"nombre": "Otro"}).status_code == 401


def test_marcar_adopcion_exige_clave_de_servicio(api_mascotas, mascota):
    ruta = f"/mascotas/{mascota['id']}/adopcion"
    cuerpo = {"solicitud_id": str(uuid.uuid4())}
    assert api_mascotas.put(ruta, json=cuerpo).status_code == 401
    assert api_mascotas.put(ruta, json=cuerpo, headers=HEADERS_ADMIN).status_code == 401


def test_estado_adoptada_no_se_asigna_a_mano(api_mascotas, mascota):
    respuesta = api_mascotas.patch(f"/mascotas/{mascota['id']}", headers=HEADERS_ADMIN, json={"estado": "adoptada"})
    assert respuesta.status_code == 422


def test_cada_servicio_solo_accede_a_su_esquema(conexion_servicio):
    with conexion_servicio("adopciones_svc", "adopciones_local") as conexion:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            conexion.execute("SELECT * FROM mascotas.mascotas LIMIT 1")
    with conexion_servicio("mascotas_svc", "mascotas_local") as conexion:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            conexion.execute("SELECT * FROM adopciones.solicitudes LIMIT 1")


def test_la_base_impide_dos_aprobadas_para_la_misma_mascota(conexion_servicio):
    """Última barrera: el índice único actúa aunque falle la lógica de la API."""
    mascota_id = uuid.uuid4()
    insertar = (
        "INSERT INTO adopciones.solicitudes (mascota_id, mascota_nombre, solicitante_nombre, solicitante_email,"
        " solicitante_telefono, ciudad, vivienda, motivacion, estado, decidido_en)"
        " VALUES (%s, 'Prueba', 'Diego Pacheco', %s, '3001112233', 'Ocaña', 'casa',"
        " 'Motivación de una prueba de la base.', 'aprobada', now())"
    )
    with conexion_servicio("adopciones_svc", "adopciones_local") as conexion:
        conexion.execute(insertar, (mascota_id, "a@correo.co"))
        with pytest.raises(psycopg.errors.UniqueViolation):
            conexion.execute(insertar, (mascota_id, "b@correo.co"))
        conexion.rollback()


def test_si_mascotas_no_responde_no_cambia_nada(servicios, api_adopciones, mascota, nueva_solicitud):
    """Se detiene de verdad el proceso de Mascotas. Debe ir al final: lo reinicia al terminar."""
    solicitud = nueva_solicitud(mascota["id"]).json()

    servicios["mascotas"].terminate()
    servicios["mascotas"].wait(timeout=10)
    try:
        aprobacion = api_adopciones.post(f"/solicitudes/{solicitud['id']}/aprobar", headers=HEADERS_ADMIN)
        assert aprobacion.status_code == 503
        assert "no responde" in aprobacion.json()["detail"]
        assert api_adopciones.get(f"/solicitudes/{solicitud['id']}").json()["estado"] == "pendiente"
        assert nueva_solicitud(mascota["id"]).status_code == 503
    finally:
        servicios["mascotas"] = iniciar_mascotas()

    # Al volver el servicio, la misma aprobación termina bien.
    assert api_adopciones.post(f"/solicitudes/{solicitud['id']}/aprobar", headers=HEADERS_ADMIN).status_code == 200
