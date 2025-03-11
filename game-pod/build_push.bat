@echo off
set IMAGE_NAME=igormendonca/damas-pod
set TAG=latest
@REM set REGISTRY=your-docker-registry-url  :: Se estiver usando o Docker Hub, pode deixar vazio ou usar 'docker.io'

echo Realizando login no Docker Registry...
docker login 

if %ERRORLEVEL% neq 0 (
    echo Falha no login! Verifique suas credenciais.
    exit /b 1
)

echo Construindo a imagem Docker...
docker build -t %IMAGE_NAME%:%TAG% .

if %ERRORLEVEL% neq 0 (
    echo Erro ao construir a imagem Docker.
    exit /b 1
)

echo Enviando a imagem para o Docker Registry...
docker push %IMAGE_NAME%:%TAG%

if %ERRORLEVEL% neq 0 (
    echo Falha ao enviar a imagem para o Docker Registry.
    exit /b 1
)

echo Operação concluída com sucesso!
pause
