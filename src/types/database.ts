export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      sucursales: {
        Row: {
          id: string;
          created_at: string;
          nombre: string;
          direccion: string | null;
          ciudad: string | null;
          provincia: string | null;
          principal: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["sucursales"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["sucursales"]["Insert"]>;
        Relationships: [];
      };
      usuarios: {
        Row: {
          id: string;
          created_at: string;
          sucursal_id: string | null;
          auth_id: string;
          nombre: string;
          email: string;
          rol: "titular" | "contable";
          activo: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["usuarios"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["usuarios"]["Insert"]>;
        Relationships: [];
      };
      clientes: {
        Row: {
          id: string;
          created_at: string;
          sucursal_id: string | null;
          nombre: string;
          apellido: string;
          dni: string | null;
          cuit: string | null;
          telefono: string | null;
          whatsapp: string | null;
          email: string | null;
          direccion: string | null;
          tipo: "propietario" | "inquilino" | "lead" | "otro";
          auth_id: string | null;
          acceso_activo: boolean;
          observaciones: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["clientes"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["clientes"]["Insert"]>;
        Relationships: [];
      };
      propiedades: {
        Row: {
          id: string;
          created_at: string;
          sucursal_id: string | null;
          codigo: string;
          titulo: string;
          tipo: "Casa" | "Departamento" | "PH" | "Finca" | "Oficina" | "Local" | "Lote";
          operacion: "Venta" | "Alquiler";
          precio: number;
          moneda: "USD" | "ARS";
          direccion: string | null;
          barrio: string | null;
          ciudad: string | null;
          provincia: string | null;
          lat: number | null;
          lng: number | null;
          ambientes: number | null;
          dormitorios: number | null;
          banos: number | null;
          cocheras: number | null;
          m2_cubiertos: number | null;
          m2_totales: number | null;
          antiguedad: number | null;
          estado_conservacion: string | null;
          patio: boolean | null;
          expensas: number | null;
          descripcion: string | null;
          estado: "Activa" | "Reservada" | "Vendida" | "Alquilada";
          publicada_web: boolean;
          propietario_id: string | null;
          servicios: Json | null;
        };
        Insert: Omit<Database["public"]["Tables"]["propiedades"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["propiedades"]["Insert"]>;
        Relationships: [];
      };
      propiedad_medios: {
        Row: {
          id: string;
          created_at: string;
          propiedad_id: string;
          tipo: "foto" | "video" | "plano" | "tour" | "adjunto";
          url: string;
          orden: number;
        };
        Insert: Omit<Database["public"]["Tables"]["propiedad_medios"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["propiedad_medios"]["Insert"]>;
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          created_at: string;
          sucursal_id: string | null;
          cliente_id: string | null;
          nombre: string;
          interes: string | null;
          propiedad_id: string | null;
          valor_estimado: number | null;
          origen: "Web" | "WhatsApp" | "Instagram" | "ZonaProp" | "Argenprop" | "Mercado Libre" | "Referido";
          etapa: "nuevo" | "contactado" | "visita" | "negociacion" | "reserva" | "cerrada";
          asignado_a: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["leads"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
        Relationships: [];
      };
      lead_actividades: {
        Row: {
          id: string;
          created_at: string;
          lead_id: string;
          tipo: "llamada" | "email" | "whatsapp" | "reunion" | "visita" | "nota";
          detalle: string | null;
          fecha: string;
        };
        Insert: Omit<Database["public"]["Tables"]["lead_actividades"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["lead_actividades"]["Insert"]>;
        Relationships: [];
      };
      captaciones: {
        Row: {
          id: string;
          created_at: string;
          sucursal_id: string | null;
          cliente_id: string;
          direccion: string;
          tipo: string;
          operacion: "Venta" | "Alquiler";
          valor_pretendido: number | null;
          etapa: "Pendiente" | "Tasando" | "Negociando" | "Autorizada" | "Publicada";
          proxima_accion: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["captaciones"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["captaciones"]["Insert"]>;
        Relationships: [];
      };
      tasaciones: {
        Row: {
          id: string;
          created_at: string;
          sucursal_id: string | null;
          numero: string;
          propiedad_ref: string | null;
          direccion: string;
          tipo: string;
          estado_conservacion: string | null;
          zona: string | null;
          m2_terreno: number | null;
          m2_cubierto: number | null;
          precio_m2_terreno: number | null;
          precio_m2_cubierto: number | null;
          antiguedad_anios: number | null;
          score_transporte: number | null;
          score_servicios: number | null;
          score_seguridad: number | null;
          score_entorno: number | null;
          valor_min: number | null;
          valor_recomendado: number | null;
          valor_optimo: number | null;
          valor_final: number | null;
          observaciones: string | null;
          pdf_url: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["tasaciones"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["tasaciones"]["Insert"]>;
        Relationships: [];
      };
      contratos: {
        Row: {
          id: string;
          created_at: string;
          sucursal_id: string | null;
          tipo: "alq_viv" | "alq_com" | "compraventa" | "comodato" | "reserva" | "admin";
          propiedad_id: string | null;
          parte_a_id: string;
          parte_b_id: string;
          monto: number | null;
          moneda: "USD" | "ARS";
          indice_ajuste: "ICL" | "IPC" | "CasaPropia" | "Anual" | null;
          fecha_inicio: string | null;
          fecha_fin: string | null;
          estado: "borrador" | "enviado" | "firmado";
          pdf_url: string | null;
          cuerpo: Json | null;
        };
        Insert: Omit<Database["public"]["Tables"]["contratos"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["contratos"]["Insert"]>;
        Relationships: [];
      };
      firmas: {
        Row: {
          id: string;
          created_at: string;
          contrato_id: string;
          firmante: string;
          fecha: string;
          hora: string;
          ip: string | null;
          usuario: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["firmas"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["firmas"]["Insert"]>;
        Relationships: [];
      };
      alquileres: {
        Row: {
          id: string;
          created_at: string;
          sucursal_id: string | null;
          contrato_id: string;
          propiedad_id: string;
          inquilino_id: string;
          propietario_id: string;
          canon: number;
          proximo_ajuste: string;
          indice: "ICL" | "IPC" | "CasaPropia" | "Anual";
          dia_vencimiento: number;
          estado_pago: "al_dia" | "pendiente" | "vencido";
          dias_mora: number;
        };
        Insert: Omit<Database["public"]["Tables"]["alquileres"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["alquileres"]["Insert"]>;
        Relationships: [];
      };
      liquidaciones: {
        Row: {
          id: string;
          created_at: string;
          sucursal_id: string | null;
          propietario_id: string;
          propiedad_id: string;
          periodo: string;
          alquiler_cobrado: number;
          comision: number;
          gastos: number;
          retencion: number;
          neto: number;
          estado: "Pendiente" | "Aprobada" | "Pagada";
          pdf_url: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["liquidaciones"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["liquidaciones"]["Insert"]>;
        Relationships: [];
      };
      recibos: {
        Row: {
          id: string;
          created_at: string;
          sucursal_id: string | null;
          numero: string;
          cliente_id: string;
          concepto: string;
          honorarios: number;
          iva: number;
          total: number;
          moneda: "USD" | "ARS";
          qr_payload: string | null;
          pdf_url: string | null;
          enviado_por: "email" | "whatsapp" | null;
          fecha: string;
        };
        Insert: Omit<Database["public"]["Tables"]["recibos"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["recibos"]["Insert"]>;
        Relationships: [];
      };
      movimientos_caja: {
        Row: {
          id: string;
          created_at: string;
          sucursal_id: string | null;
          fecha: string;
          hora: string;
          concepto: string;
          categoria: string | null;
          medio: "efectivo" | "transferencia" | "cheque" | "tarjeta";
          monto: number;
          es_ingreso: boolean;
          cierre_id: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["movimientos_caja"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["movimientos_caja"]["Insert"]>;
        Relationships: [];
      };
      caja_cierres: {
        Row: {
          id: string;
          created_at: string;
          sucursal_id: string | null;
          fecha: string;
          apertura: number;
          total_ingresos: number;
          total_egresos: number;
          saldo: number;
          tipo: "diario" | "mensual";
        };
        Insert: Omit<Database["public"]["Tables"]["caja_cierres"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["caja_cierres"]["Insert"]>;
        Relationships: [];
      };
      movimientos_finanzas: {
        Row: {
          id: string;
          created_at: string;
          sucursal_id: string | null;
          concepto: string;
          fecha: string;
          categoria: string;
          monto: number;
          moneda: "USD" | "ARS";
          es_ingreso: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["movimientos_finanzas"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["movimientos_finanzas"]["Insert"]>;
        Relationships: [];
      };
      documentos: {
        Row: {
          id: string;
          created_at: string;
          sucursal_id: string | null;
          nombre: string;
          categoria: "contratos" | "escrituras" | "tasaciones" | "recibos" | "dni" | "comprobantes";
          vinculado_a: string | null;
          storage_path: string;
          version: number;
          permiso: "privado" | "equipo" | "solo_lectura" | "cliente";
          subido_por: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["documentos"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["documentos"]["Insert"]>;
        Relationships: [];
      };
      eventos_agenda: {
        Row: {
          id: string;
          created_at: string;
          sucursal_id: string | null;
          titulo: string;
          fecha: string;
          hora: string;
          tipo: "visita" | "cobro" | "renovacion" | "reunion";
          propiedad_id: string | null;
          cliente_id: string | null;
          google_event_id: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["eventos_agenda"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["eventos_agenda"]["Insert"]>;
        Relationships: [];
      };
      comisiones: {
        Row: {
          id: string;
          created_at: string;
          sucursal_id: string | null;
          admin_alquiler_pct: number;
          venta_pct: number;
          tasacion_pct: number;
        };
        Insert: Omit<Database["public"]["Tables"]["comisiones"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["comisiones"]["Insert"]>;
        Relationships: [];
      };
      favoritos: {
        Row: {
          id: string;
          created_at: string;
          cliente_id: string | null;
          session_key: string | null;
          propiedad_id: string;
        };
        Insert: Omit<Database["public"]["Tables"]["favoritos"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["favoritos"]["Insert"]>;
        Relationships: [];
      };
      auditoria: {
        Row: {
          id: string;
          created_at: string;
          usuario_id: string | null;
          accion: string;
          entidad: string;
          entidad_id: string | null;
          payload: Json | null;
          fecha: string;
        };
        Insert: Omit<Database["public"]["Tables"]["auditoria"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["auditoria"]["Insert"]>;
        Relationships: [];
      };
      indices: {
        Row: {
          id: string;
          created_at: string;
          fecha: string;
          tipo: "ICL" | "IPC" | "CasaPropia";
          valor: number;
        };
        Insert: Omit<Database["public"]["Tables"]["indices"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["indices"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      portal_alquileres_propietario: {
        Row: {
          id: string;
          propiedad_id: string;
          canon: number;
          proximo_ajuste: string;
          indice: "ICL" | "IPC" | "CasaPropia" | "Anual";
          estado_pago: "al_dia" | "pendiente" | "vencido";
          dias_mora: number;
          inquilino: string;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// Helpers
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
