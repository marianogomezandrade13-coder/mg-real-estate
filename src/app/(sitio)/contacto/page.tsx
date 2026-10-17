import type { Metadata } from "next";
import { ContactoClient } from "./ContactoClient";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Escribinos por una propiedad, una tasación o para vender o alquilar tu inmueble. Respondemos en menos de 24 horas hábiles.",
};

export default function ContactoPage() {
  return <ContactoClient />;
}
