# ra-egress/Dockerfile
#
# Multi-stage build — sonuç ~10MB scratch image, statik binary.

FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod ./
# go.sum yok çünkü standart kütüphane dışı dep kullanmıyoruz
COPY main.go ./
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /out/ra-egress .

FROM scratch
COPY --from=build /out/ra-egress /ra-egress
# TLS cert bundle — publisher HTTPS çağrıları için
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
EXPOSE 8080
ENTRYPOINT ["/ra-egress"]
